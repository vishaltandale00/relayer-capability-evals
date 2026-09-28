import { createHash } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { bindAutonomousCaseSnapshot, canonicalJson } from "@relayer/eval-runner";
import { createAutonomousCaseSnapshot } from "@relayer/eval-runner";
import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandResult, CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
import {
  inspectSpreadsheetWorkbook,
  SPREADSHEET_RUNTIME_SOURCE_SHA256,
  type SpreadsheetRuntimeConfig,
  type SpreadsheetSemanticMutation,
  type SpreadsheetSheetSnapshot,
  type SpreadsheetWorkbookReceipt,
} from "./spreadsheet-runtime.js";

export const PRODUCTION_DELIVERY_PLANNER_CASE_ID = "capability.spreadsheet.production-delivery-planner" as const;
export const PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256 = "d995f5d5f35e7366099a08fe5838dbbd0d62605088155548002cdd582be9fd1f";
export const PRODUCTION_DELIVERY_PLANNER_OUTPUT = "production-delivery-plan.xlsx" as const;
export const PRODUCTION_DELIVERY_PLANNER_SOURCE = "relayer-eval://production-delivery-planner-v1" as const;

export interface PlannerOrderInput {
  readonly orderId: string;
  readonly customer: string;
  readonly sku: string;
  readonly quantity: number;
  readonly orderDate: string;
  readonly requestedDeliveryDate: string;
  readonly priority: "standard" | "priority";
}

export interface PlannerBomInput {
  readonly sku: string;
  readonly component: string;
  readonly quantityPerUnit: number;
}

export interface PlannerInventoryInput {
  readonly item: string;
  readonly itemType: "finished-good" | "component";
  readonly quantityOnHand: number;
  readonly holdingCostPerUnitWeek: number;
}

export interface PlannerSupplierInput {
  readonly supplier: string;
  readonly component: string;
  readonly normalLeadTimeWeeks: number;
  readonly expediteLeadTimeWeeks: number;
  readonly unitCost: number;
  readonly expeditePremiumPerUnit: number;
}

export interface PlannerCapacityInput {
  readonly week: string;
  readonly hours: number;
}

export interface PlannerShippingInput {
  readonly mode: string;
  readonly transitDays: number;
  readonly costPerUnit: number;
}

export interface PlannerProductInput {
  readonly sku: string;
  readonly productionHoursPerUnit: number;
  readonly productionCostPerUnit: number;
}

export interface ProductionDeliveryPlannerInputs {
  readonly schemaVersion: 1;
  readonly horizonStart: string;
  readonly horizonWeeks: 12;
  readonly orders: readonly PlannerOrderInput[];
  readonly billOfMaterials: readonly PlannerBomInput[];
  readonly inventory: readonly PlannerInventoryInput[];
  readonly suppliers: readonly PlannerSupplierInput[];
  readonly weeklyCapacity: readonly PlannerCapacityInput[];
  readonly shippingOptions: readonly PlannerShippingInput[];
  readonly products: readonly PlannerProductInput[];
}

const weeks = Object.freeze([
  "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
  "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26",
  "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23",
]);

export const productionDeliveryPlannerInputs: ProductionDeliveryPlannerInputs = deepFreeze({
  schemaVersion: 1,
  horizonStart: weeks[0]!,
  horizonWeeks: 12,
  orders: [
    { orderId: "ORD-1001", customer: "Northstar Health", sku: "FG-ALPHA", quantity: 18, orderDate: "2026-09-01", requestedDeliveryDate: "2026-09-18", priority: "priority" },
    { orderId: "ORD-1002", customer: "Atlas Retail", sku: "FG-BETA", quantity: 16, orderDate: "2026-09-02", requestedDeliveryDate: "2026-10-02", priority: "standard" },
    { orderId: "ORD-1003", customer: "Summit Labs", sku: "FG-GAMMA", quantity: 12, orderDate: "2026-09-05", requestedDeliveryDate: "2026-10-16", priority: "priority" },
    { orderId: "ORD-1004", customer: "Redwood Supply", sku: "FG-ALPHA", quantity: 28, orderDate: "2026-09-08", requestedDeliveryDate: "2026-10-30", priority: "standard" },
    { orderId: "ORD-1005", customer: "Bluebird Systems", sku: "FG-BETA", quantity: 24, orderDate: "2026-09-11", requestedDeliveryDate: "2026-11-13", priority: "standard" },
    { orderId: "ORD-1006", customer: "Cobalt Works", sku: "FG-GAMMA", quantity: 70, orderDate: "2026-09-01", requestedDeliveryDate: "2026-09-18", priority: "priority" },
  ],
  billOfMaterials: [
    { sku: "FG-ALPHA", component: "CMP-A", quantityPerUnit: 2 },
    { sku: "FG-ALPHA", component: "CMP-B", quantityPerUnit: 1 },
    { sku: "FG-BETA", component: "CMP-A", quantityPerUnit: 1 },
    { sku: "FG-BETA", component: "CMP-C", quantityPerUnit: 3 },
    { sku: "FG-GAMMA", component: "CMP-B", quantityPerUnit: 2 },
    { sku: "FG-GAMMA", component: "CMP-D", quantityPerUnit: 1 },
    { sku: "FG-GAMMA", component: "CMP-E", quantityPerUnit: 2 },
  ],
  inventory: [
    { item: "FG-ALPHA", itemType: "finished-good", quantityOnHand: 10, holdingCostPerUnitWeek: 0.45 },
    { item: "FG-BETA", itemType: "finished-good", quantityOnHand: 4, holdingCostPerUnitWeek: 0.5 },
    { item: "FG-GAMMA", itemType: "finished-good", quantityOnHand: 0, holdingCostPerUnitWeek: 0.65 },
    { item: "CMP-A", itemType: "component", quantityOnHand: 55, holdingCostPerUnitWeek: 0.08 },
    { item: "CMP-B", itemType: "component", quantityOnHand: 24, holdingCostPerUnitWeek: 0.06 },
    { item: "CMP-C", itemType: "component", quantityOnHand: 18, holdingCostPerUnitWeek: 0.09 },
    { item: "CMP-D", itemType: "component", quantityOnHand: 4, holdingCostPerUnitWeek: 0.12 },
    { item: "CMP-E", itemType: "component", quantityOnHand: 10, holdingCostPerUnitWeek: 0.11 },
  ],
  suppliers: [
    { supplier: "Apex Components", component: "CMP-A", normalLeadTimeWeeks: 3, expediteLeadTimeWeeks: 1, unitCost: 4.2, expeditePremiumPerUnit: 1.4 },
    { supplier: "Beacon Industrial", component: "CMP-B", normalLeadTimeWeeks: 2, expediteLeadTimeWeeks: 1, unitCost: 2.8, expeditePremiumPerUnit: 1.1 },
    { supplier: "Cirrus Parts", component: "CMP-C", normalLeadTimeWeeks: 4, expediteLeadTimeWeeks: 2, unitCost: 5.5, expeditePremiumPerUnit: 1.8 },
    { supplier: "Delta Fabrication", component: "CMP-D", normalLeadTimeWeeks: 5, expediteLeadTimeWeeks: 2, unitCost: 8.6, expeditePremiumPerUnit: 2.6 },
    { supplier: "Evergreen Metals", component: "CMP-E", normalLeadTimeWeeks: 3, expediteLeadTimeWeeks: 1, unitCost: 3.7, expeditePremiumPerUnit: 1.3 },
  ],
  weeklyCapacity: weeks.map((week, index) => ({ week, hours: [62, 58, 66, 60, 64, 56, 68, 60, 64, 58, 54, 48][index]! })),
  shippingOptions: [
    { mode: "Ground", transitDays: 5, costPerUnit: 7 },
    { mode: "Two-Day", transitDays: 2, costPerUnit: 13 },
    { mode: "Next-Day", transitDays: 1, costPerUnit: 22 },
  ],
  products: [
    { sku: "FG-ALPHA", productionHoursPerUnit: 1.5, productionCostPerUnit: 18 },
    { sku: "FG-BETA", productionHoursPerUnit: 2, productionCostPerUnit: 24 },
    { sku: "FG-GAMMA", productionHoursPerUnit: 2.5, productionCostPerUnit: 31 },
  ],
});

export const productionDeliveryPlannerVisibleTask = `Build ${PRODUCTION_DELIVERY_PLANNER_OUTPUT} from the seven supplied CSV inputs and horizon file. The workbook must be a usable, formula-driven twelve-week production and fulfillment planner, not a static report.

Include editable scenario controls for demand, capacity, supplier lead time, and expedite policy; a weekly SKU production plan; component inventory and purchasing receipts; normal-versus-expedited purchase decisions; per-order requested, planned ship, and projected delivery dates; shipping choices; explicit late, short, and infeasible exceptions; auditable production, purchasing, expedite, shipping, holding, and total costs; and a management dashboard with the main service, capacity, exception, and cost signals.

Preserve every source order and SKU. Keep assumptions and raw inputs visibly separate from calculated outputs, use formulas for derived results, and make the model respond when inputs or scenario controls change. The workbook may use any reasonable sheet names and layout. Verify formulas and rendering, commit the finished workbook, leave the workspace clean, and do not push or publish anything.`;

const fixtureFiles: Readonly<Record<string, string>> = deepFreeze({
  "README.md": `# Production and Delivery Planner\n\n${productionDeliveryPlannerVisibleTask}\n`,
  "inputs/customer-orders.csv": csv(productionDeliveryPlannerInputs.orders),
  "inputs/bill-of-materials.csv": csv(productionDeliveryPlannerInputs.billOfMaterials),
  "inputs/inventory.csv": csv(productionDeliveryPlannerInputs.inventory),
  "inputs/supplier-lead-times-costs.csv": csv(productionDeliveryPlannerInputs.suppliers),
  "inputs/weekly-production-capacity.csv": csv(productionDeliveryPlannerInputs.weeklyCapacity),
  "inputs/shipping-options.csv": csv(productionDeliveryPlannerInputs.shippingOptions),
  "inputs/product-economics.csv": csv(productionDeliveryPlannerInputs.products),
  "inputs/horizon.json": `${JSON.stringify({ start: productionDeliveryPlannerInputs.horizonStart, weeks: productionDeliveryPlannerInputs.horizonWeeks }, null, 2)}\n`,
});

export const PRODUCTION_DELIVERY_PLANNER_FIXTURE_CONTENT_DIGEST = digest(canonicalJson(fixtureFiles));
export const PRODUCTION_DELIVERY_PLANNER_SOURCE_REVISION = `fixture:${PRODUCTION_DELIVERY_PLANNER_FIXTURE_CONTENT_DIGEST}` as const;

export const productionDeliveryPlannerRuntimeContract = deepFreeze({
  id: "relayer-spreadsheet-runtime-v1",
  bundle: "26.826.12353",
  node: "24.19.0",
  artifactTool: "2.8.59",
  nodeExecutableDigest: "sha256:27db838bb204ef7c21df2931f5656e4c8fb32e6e947f363a402b49714d32b5b1",
  artifactToolEntrypointDigest: "sha256:d23c29992898aaf6efc0f78611ee34ba213579fa25e05ad4dc5dbcb356c11a89",
  artifactToolContentDigest: "sha256:eb3c0b54042c490c79837b4cd093028f34f2199e22236977ddbba6ec0482924c",
  workbookFormat: "xlsx",
  capabilities: ["author", "import", "calculate", "inspect", "mutate", "render"],
} as const);
export const PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST = digest(canonicalJson(productionDeliveryPlannerRuntimeContract));

export interface ProductionDeliveryPlannerCaseDefinition {
  readonly schemaVersion: 1;
  readonly id: typeof PRODUCTION_DELIVERY_PLANNER_CASE_ID;
  readonly name: string;
  readonly description: string;
  readonly localOnly: true;
  readonly supportedPlatform: "darwin";
  readonly autonomous: true;
  readonly category: "work";
  readonly taskType: "spreadsheet-model";
  readonly fixture: {
    readonly source: typeof PRODUCTION_DELIVERY_PLANNER_SOURCE;
    readonly revision: typeof PRODUCTION_DELIVERY_PLANNER_SOURCE_REVISION;
    readonly contentDigest: typeof PRODUCTION_DELIVERY_PLANNER_FIXTURE_CONTENT_DIGEST;
    readonly environmentDigest: typeof PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST;
  };
  readonly threads: readonly ProjectEvalThreadDefinition[];
}

const definition: ProductionDeliveryPlannerCaseDefinition = deepFreeze({
  schemaVersion: 1,
  id: PRODUCTION_DELIVERY_PLANNER_CASE_ID,
  name: "Excel · production and delivery planner",
  description: "Builds a responsive twelve-week production, purchasing, fulfillment, exception, and cost workbook.",
  localOnly: true,
  supportedPlatform: "darwin",
  autonomous: true,
  category: "work",
  taskType: "spreadsheet-model",
  fixture: {
    source: PRODUCTION_DELIVERY_PLANNER_SOURCE,
    revision: PRODUCTION_DELIVERY_PLANNER_SOURCE_REVISION,
    contentDigest: PRODUCTION_DELIVERY_PLANNER_FIXTURE_CONTENT_DIGEST,
    environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  },
  threads: [{
    id: "planner",
    name: "Build production and delivery planner",
    permissionProfileId: "auto",
    mutationPolicy: "writable",
    workspaceGrade: "autonomous-implementation",
    prompts: [productionDeliveryPlannerVisibleTask],
  }],
});

const mandatoryGates = deepFreeze([
  { id: "workbook-integrity", label: "Workbook integrity", description: "The delivered XLSX parses, contains formulas and scenario controls, and renders every required semantic view." },
  { id: "planning-integrity", label: "Planning integrity", description: "Order coverage, conservation, BOM dependencies, capacity, dates, and exception handling reconcile independently." },
  { id: "financial-integrity", label: "Cost integrity", description: "All cost categories and management totals reconcile to independently recomputed amounts." },
  { id: "responsive-model", label: "Changed-input response", description: "Source inputs and each editable scenario control change the calculated plan through workbook formulas while preserving feasibility." },
  { id: "committed-workbook", label: "Committed workbook", description: "The requested workbook is committed and the workspace is clean." },
]);

export const PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT = deepFreeze({
  schemaVersion: 1,
  verifierSourceSha256: PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256,
  spreadsheetRuntimeSourceSha256: SPREADSHEET_RUNTIME_SOURCE_SHA256,
  extraction: "semantic-header-and-stable-identifier-v1",
  dashboardPolicy: "co-located-service-exception-cost-and-capacity-signals-v1",
  changedInputConsistency: "full-semantic-reverification-v1",
  mandatoryGates,
  predicates: [
    "runtime-identity", "workbook-parse", "source-coverage", "workbook-horizon", "scenario-controls", "formula-lineage", "workbook-rendering",
    "complete-order-coverage", "order-conservation", "component-dependencies", "finished-goods-conservation", "weekly-capacity",
    "purchase-lead-times", "fulfillment-dates", "infeasible-exceptions", "cost-arithmetic", "cross-sheet-consistency",
    "changed-input-order-quantity", "changed-input-capacity-hours", "changed-input-supplier-lead-time",
    "changed-scenario-demand-multiplier", "changed-scenario-capacity-multiplier",
    "changed-scenario-supplier-lead-time-adjustment", "changed-scenario-expedite-enabled",
    "required-workbook", "delivery-commit", "delivery-clean",
  ],
  formulaLineagePolicy: "no-formula-errors-and-located-derived-table-formula-v1",
  scenarioMutationPolicy: [
    { kind: "scenario-demand-multiplier", selection: "halve-current-positive-demand-factor-v1" },
    { kind: "scenario-capacity-multiplier", selection: "bind-to-half-peak-production-utilization-or-reduce-current-when-production-is-zero-v1" },
    { kind: "scenario-supplier-lead-time-adjustment", selection: "increase-current-adjustment-by-one-week-v1" },
    { kind: "scenario-expedite-enabled", selection: "toggle-current-expedite-policy-v1" },
  ],
  mutations: [
    { kind: "order-quantity", orderId: "ORD-1004", quantity: 35 },
    { kind: "order-quantity", orderId: "ORD-1004", quantity: 41 },
    { kind: "capacity-hours", week: weeks[3]!, hours: 35 },
    { kind: "capacity-hours", week: weeks[3]!, hours: 49 },
    { kind: "supplier-lead-time", component: "CMP-D", normalLeadTimeWeeks: 6 },
    { kind: "supplier-lead-time", component: "CMP-D", normalLeadTimeWeeks: 7 },
  ],
  layoutMatching: false,
  referenceWorkbookMatching: false,
  runtime: productionDeliveryPlannerRuntimeContract,
});

const criteria = deepFreeze([
  { id: "correctness", label: "Planning correctness", description: "The plan is feasible where claimed and explicit about late, short, or infeasible demand.", weight: 3 },
  { id: "decision-usefulness", label: "Decision usefulness", description: "The scenarios, exceptions, costs, and dashboard support management decisions.", weight: 2 },
  { id: "auditability", label: "Workbook auditability", description: "Inputs, assumptions, formulas, and cross-sheet totals are traceable and maintainable.", weight: 1 },
]);

const snapshot = createAutonomousCaseSnapshot({
  id: definition.id,
  name: definition.name,
  description: definition.description,
  category: definition.category,
  taskType: definition.taskType,
  artifacts: {
    task: { kind: "visible-task", text: productionDeliveryPlannerVisibleTask, contentDigest: digest(productionDeliveryPlannerVisibleTask) },
    workspace: {
      kind: "frozen-workspace",
      materializerId: "production-delivery-planner-v1",
      source: definition.fixture.source,
      revision: definition.fixture.revision,
      contentDigest: definition.fixture.contentDigest,
      environmentDigest: definition.fixture.environmentDigest,
    },
    reference: {
      kind: "sealed-reference",
      artifactId: "production-delivery-planner-semantic-contract-v1",
      format: "semantic-contract",
      contentDigest: digest(canonicalJson({ inputs: productionDeliveryPlannerInputs, criteria, noPrivilegedLayout: true })),
      sealedPath: "packages/capability-evals/src/project-cases/production-delivery-planner.ts",
    },
    verifier: {
      kind: "sealed-verifier",
      artifactId: "production-delivery-planner-verifier-v1",
      verifierId: "production-delivery-planner-v1",
      contentDigest: digest(canonicalJson(PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT)),
      sealedPath: "packages/capability-evals/src/project-cases/production-delivery-planner.ts",
      mandatoryGates,
    },
    outcomeRubric: {
      kind: "outcome-rubric",
      rubricVersion: "production-delivery-planner-outcome-v1",
      criteria,
      contentDigest: digest(canonicalJson(criteria)),
    },
  },
});

export const productionDeliveryPlannerCase = bindAutonomousCaseSnapshot(definition, snapshot);
export const productionDeliveryPlannerCases = Object.freeze([productionDeliveryPlannerCase]);
export const productionDeliveryPlannerCaseIds = new Set([PRODUCTION_DELIVERY_PLANNER_CASE_ID]);

export interface ProductionDeliveryPlannerFixtureReceipt {
  readonly schemaVersion: 1;
  readonly fixtureId: typeof PRODUCTION_DELIVERY_PLANNER_CASE_ID;
  readonly workspaceDirectory: string;
  readonly repositoryUrl: typeof PRODUCTION_DELIVERY_PLANNER_SOURCE;
  readonly sourceRevision: typeof PRODUCTION_DELIVERY_PLANNER_SOURCE_REVISION;
  readonly contentDigest: typeof PRODUCTION_DELIVERY_PLANNER_FIXTURE_CONTENT_DIGEST;
  readonly environmentDigest: typeof PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST;
  readonly seededCommit: string;
  readonly seededTree: string;
  readonly packageManager: "none";
  readonly installedWithFrozenLockfile: false;
}

export async function materializeProductionDeliveryPlannerFixture(options: {
  readonly workspaceDirectory: string;
  readonly platform?: NodeJS.Platform;
  readonly runCommand?: CommandRunner;
}): Promise<ProductionDeliveryPlannerFixtureReceipt> {
  if ((options.platform ?? process.platform) !== "darwin") throw new Error("The production and delivery planner case is local Mac only.");
  await requireMissing(options.workspaceDirectory);
  await mkdir(options.workspaceDirectory, { recursive: true, mode: 0o700 });
  for (const [relativePath, contents] of Object.entries(fixtureFiles)) {
    const target = join(options.workspaceDirectory, relativePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, contents, "utf8");
  }
  const runCommand = options.runCommand ?? run;
  await required(runCommand, "git", ["init", "--quiet", "--initial-branch=main"], options.workspaceDirectory);
  await required(runCommand, "git", ["config", "user.name", "Relayer Eval Fixture"], options.workspaceDirectory);
  await required(runCommand, "git", ["config", "user.email", "eval-fixture@relayer.local"], options.workspaceDirectory);
  await required(runCommand, "git", ["add", "--all"], options.workspaceDirectory);
  await required(runCommand, "git", ["commit", "--quiet", "-m", `Seed ${PRODUCTION_DELIVERY_PLANNER_CASE_ID}`], options.workspaceDirectory, {
    GIT_AUTHOR_DATE: "2026-08-28T12:00:00Z",
    GIT_COMMITTER_DATE: "2026-08-28T12:00:00Z",
  });
  const seededCommit = (await required(runCommand, "git", ["rev-parse", "HEAD"], options.workspaceDirectory)).stdout.trim();
  const seededTree = (await required(runCommand, "git", ["rev-parse", "HEAD^{tree}"], options.workspaceDirectory)).stdout.trim();
  return deepFreeze({
    schemaVersion: 1,
    fixtureId: PRODUCTION_DELIVERY_PLANNER_CASE_ID,
    workspaceDirectory: options.workspaceDirectory,
    repositoryUrl: PRODUCTION_DELIVERY_PLANNER_SOURCE,
    sourceRevision: PRODUCTION_DELIVERY_PLANNER_SOURCE_REVISION,
    contentDigest: PRODUCTION_DELIVERY_PLANNER_FIXTURE_CONTENT_DIGEST,
    environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
    seededCommit,
    seededTree,
    packageManager: "none",
    installedWithFrozenLockfile: false,
  });
}

export interface PlannerScenarioModel {
  readonly demandMultiplier: number;
  readonly capacityMultiplier: number;
  readonly supplierLeadTimeAdjustmentWeeks: number;
  readonly expediteEnabled: boolean;
}

export interface PlannerOrderProjection {
  readonly orderId: string;
  readonly sku: string;
  readonly requestedQuantity: number;
  readonly fulfilledQuantity: number;
  readonly backorderQuantity: number;
  readonly plannedShipDate: string | null;
  readonly projectedDeliveryDate: string | null;
  readonly shippingMode: string | null;
  readonly status: "on-time" | "late" | "short" | "infeasible";
}

export interface PlannerProductionRow { readonly week: string; readonly sku: string; readonly quantity: number }
export interface PlannerFinishedGoodsRow { readonly week: string; readonly sku: string; readonly opening: number; readonly produced: number; readonly shipped: number; readonly closing: number }
export interface PlannerComponentRow { readonly week: string; readonly component: string; readonly opening: number; readonly receipts: number; readonly consumed: number; readonly closing: number }
export interface PlannerPurchaseRow { readonly component: string; readonly supplier: string; readonly quantity: number; readonly orderDate: string; readonly receiptDate: string; readonly expedited: boolean; readonly unitCost: number; readonly expeditePremiumPerUnit: number }
export interface PlannerCapacityRow { readonly week: string; readonly availableHours: number; readonly usedHours: number }
export interface PlannerExceptionRow { readonly type: "late" | "short" | "infeasible" | "capacity" | "component"; readonly orderId: string | null; readonly detail: string }
export interface PlannerFormulaEvidence {
  readonly semanticRole: string;
  readonly formula: string;
  readonly precedentRoles: readonly string[];
  readonly derivedOutputCell: boolean;
}

export interface ProductionDeliveryPlannerWorkbookModel {
  readonly schemaVersion: 1;
  readonly sourceInputs: ProductionDeliveryPlannerInputs;
  readonly horizon: readonly string[];
  readonly scenario: PlannerScenarioModel;
  readonly orderProjections: readonly PlannerOrderProjection[];
  readonly production: readonly PlannerProductionRow[];
  readonly finishedGoods: readonly PlannerFinishedGoodsRow[];
  readonly components: readonly PlannerComponentRow[];
  readonly purchases: readonly PlannerPurchaseRow[];
  readonly capacity: readonly PlannerCapacityRow[];
  readonly exceptions: readonly PlannerExceptionRow[];
  readonly costs: { readonly production: number; readonly purchasing: number; readonly expedite: number; readonly shipping: number; readonly holding: number; readonly total: number };
  readonly dashboardViews: readonly PlannerDashboardView[];
  readonly sheetTotals: { readonly fulfilledUnits: number; readonly purchaseUnits: number; readonly productionUnits: number; readonly exceptionCount: number; readonly totalCost: number };
  readonly formulas: readonly PlannerFormulaEvidence[];
  readonly formulaErrors: readonly string[];
}

interface PlannerDashboardView {
  readonly sheetName: string;
  readonly summary: { readonly totalOrders: number; readonly unitsRequested: number; readonly unitsFulfilled: number; readonly lateOrders: number; readonly exceptionCount: number; readonly totalCost: number };
  readonly capacity: { readonly usedHours: number | null; readonly availableHours: number | null; readonly utilization: number | null };
  readonly productionSignal: readonly { readonly week: string; readonly units: number }[] | null;
}

export type PlannerInputMutation =
  | { readonly kind: "order-quantity"; readonly orderId: string; readonly quantity: number }
  | { readonly kind: "capacity-hours"; readonly week: string; readonly hours: number }
  | { readonly kind: "supplier-lead-time"; readonly component: string; readonly normalLeadTimeWeeks: number }
  | { readonly kind: "scenario-demand-multiplier"; readonly value: number }
  | { readonly kind: "scenario-capacity-multiplier"; readonly value: number }
  | { readonly kind: "scenario-supplier-lead-time-adjustment"; readonly value: number }
  | { readonly kind: "scenario-expedite-enabled"; readonly value: boolean };

export interface PlannerRenderSheetEvidence {
  readonly role: "inputs" | "orders" | "production" | "inventory" | "purchasing" | "exceptions" | "dashboard";
  readonly sheetName: string;
  readonly contentDigest: `sha256:${string}`;
  readonly width: number;
  readonly height: number;
  readonly readable: boolean;
}

export interface ProductionDeliveryPlannerRuntime {
  readonly identity: {
    readonly id: typeof productionDeliveryPlannerRuntimeContract.id;
    readonly environmentDigest: typeof PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST;
    readonly nodeVersion: string;
    readonly artifactToolVersion: string;
  };
  extract(workbookPath: string): Promise<ProductionDeliveryPlannerWorkbookModel>;
  recalculateWithMutation(workbookPath: string, mutation: PlannerInputMutation): Promise<ProductionDeliveryPlannerWorkbookModel>;
  render(workbookPath: string): Promise<readonly PlannerRenderSheetEvidence[]>;
}

/**
 * Adapts the generic, layout-neutral spreadsheet bridge to this case's semantic
 * model. The adapter is synchronous to construct; all runtime validation stays
 * fail-closed inside the first bridge call.
 */
export function createProductionDeliveryPlannerRuntime(config: SpreadsheetRuntimeConfig): ProductionDeliveryPlannerRuntime {
  const inspect = (workbookPath: string, mutations: readonly SpreadsheetSemanticMutation[] = [], render = false) => (
    inspectSpreadsheetWorkbook({ workbookPath, runtime: config, mutations, render })
  );
  return Object.freeze({
    identity: Object.freeze({
      id: productionDeliveryPlannerRuntimeContract.id,
      environmentDigest: config.environmentDigest,
      nodeVersion: config.nodeVersion,
      artifactToolVersion: config.artifactToolVersion,
    }),
    extract: async (workbookPath: string) => extractProductionDeliveryPlannerModel(await inspect(workbookPath)),
    recalculateWithMutation: async (workbookPath: string, mutation: PlannerInputMutation) => {
      const baseline = await inspect(workbookPath);
      const semanticMutation = plannerSpreadsheetMutation(baseline, mutation);
      return extractProductionDeliveryPlannerModel(await inspect(workbookPath, [semanticMutation]));
    },
    render: async (workbookPath: string) => plannerRenderEvidence(await inspect(workbookPath, [], true)),
  });
}

export function extractProductionDeliveryPlannerModel(receipt: SpreadsheetWorkbookReceipt): ProductionDeliveryPlannerWorkbookModel {
  const rawOrders = semanticRowsOrEmpty(receipt, rawOrderColumns).map((row) => ({
    orderId: rowText(row, "orderId"), customer: rowText(row, "customer"), sku: rowText(row, "sku"),
    quantity: rowNumber(row, "quantity"), orderDate: rowDate(row, "orderDate"),
    requestedDeliveryDate: rowDate(row, "requestedDeliveryDate"), priority: rowText(row, "priority") as PlannerOrderInput["priority"],
  }));
  const rawBom = semanticRowsOrEmpty(receipt, bomColumns).map((row) => ({ sku: rowText(row, "sku"), component: rowText(row, "component"), quantityPerUnit: rowNumber(row, "quantityPerUnit") }));
  const rawInventory = semanticRowsOrEmpty(receipt, rawInventoryColumns).map((row) => ({
    item: rowText(row, "item"), itemType: rowText(row, "itemType") as PlannerInventoryInput["itemType"],
    quantityOnHand: rowNumber(row, "quantityOnHand"), holdingCostPerUnitWeek: rowNumber(row, "holdingCostPerUnitWeek"),
  }));
  const rawSuppliers = semanticRowsOrEmpty(receipt, rawSupplierColumns).map((row) => ({
    supplier: rowText(row, "supplier"), component: rowText(row, "component"),
    normalLeadTimeWeeks: rowNumber(row, "normalLeadTimeWeeks"), expediteLeadTimeWeeks: rowNumber(row, "expediteLeadTimeWeeks"),
    unitCost: rowNumber(row, "unitCost"), expeditePremiumPerUnit: rowNumber(row, "expeditePremiumPerUnit"),
  }));
  const rawCapacity = semanticRowsOrEmpty(receipt, rawCapacityColumns).map((row) => ({ week: rowDate(row, "week"), hours: rowNumber(row, "hours") }));
  const rawShipping = semanticRowsOrEmpty(receipt, rawShippingColumns).map((row) => ({ mode: rowText(row, "mode"), transitDays: rowNumber(row, "transitDays"), costPerUnit: rowNumber(row, "costPerUnit") }));
  const rawProducts = semanticRowsOrEmpty(receipt, rawProductColumns).map((row) => ({ sku: rowText(row, "sku"), productionHoursPerUnit: rowNumber(row, "productionHoursPerUnit"), productionCostPerUnit: rowNumber(row, "productionCostPerUnit") }));
  const orderRows = semanticRowsOrEmpty(receipt, orderProjectionColumns);
  const productionRows = semanticRowsOrEmpty(receipt, productionColumns);
  const finishedRows = semanticRowsOrEmpty(receipt, finishedGoodsColumns);
  const componentRows = semanticRowsOrEmpty(receipt, componentColumns);
  const purchaseRows = semanticRowsOrEmpty(receipt, purchaseColumns);
  const capacityRows = semanticRowsOrEmpty(receipt, capacityColumns);
  const exceptionRows = semanticRowsOrEmpty(receipt, exceptionColumns, true);
  const scenario: PlannerScenarioModel = {
    demandMultiplier: metricNumberOrNaN(receipt, scenarioControlAliases.demandMultiplier),
    capacityMultiplier: metricNumberOrNaN(receipt, scenarioControlAliases.capacityMultiplier),
    supplierLeadTimeAdjustmentWeeks: metricNumberOrNaN(receipt, scenarioControlAliases.supplierLeadTimeAdjustmentWeeks),
    expediteEnabled: metricBooleanOrFalse(receipt, scenarioControlAliases.expediteEnabled),
  };
  const orderProjections: PlannerOrderProjection[] = orderRows.map((row) => ({
    orderId: rowText(row, "orderId"),
    sku: rowText(row, "sku"),
    requestedQuantity: rowNumber(row, "requestedQuantity"),
    fulfilledQuantity: rowNumber(row, "fulfilledQuantity"),
    backorderQuantity: rowNumber(row, "backorderQuantity"),
    plannedShipDate: rowNullableDate(row, "plannedShipDate"),
    projectedDeliveryDate: rowNullableDate(row, "projectedDeliveryDate"),
    shippingMode: rowNullableText(row, "shippingMode"),
    status: plannerStatus(rowText(row, "status")),
  }));
  const production: PlannerProductionRow[] = productionRows.map((row) => ({ week: rowDate(row, "week"), sku: rowText(row, "sku"), quantity: rowNumber(row, "quantity") }));
  const finishedGoods: PlannerFinishedGoodsRow[] = finishedRows.map((row) => ({ week: rowDate(row, "week"), sku: rowText(row, "sku"), opening: rowNumber(row, "opening"), produced: rowNumber(row, "produced"), shipped: rowNumber(row, "shipped"), closing: rowNumber(row, "closing") }));
  const components: PlannerComponentRow[] = componentRows.map((row) => ({ week: rowDate(row, "week"), component: rowText(row, "component"), opening: rowNumber(row, "opening"), receipts: rowNumber(row, "receipts"), consumed: rowNumber(row, "consumed"), closing: rowNumber(row, "closing") }));
  const purchases: PlannerPurchaseRow[] = purchaseRows.map((row) => ({
    component: rowText(row, "component"), supplier: rowText(row, "supplier"), quantity: rowNumber(row, "quantity"),
    orderDate: rowDate(row, "orderDate"), receiptDate: rowDate(row, "receiptDate"), expedited: rowBoolean(row, "expedited"),
    unitCost: rowNumber(row, "unitCost"), expeditePremiumPerUnit: rowNumber(row, "expeditePremiumPerUnit"),
  }));
  const capacity: PlannerCapacityRow[] = capacityRows.map((row) => ({ week: rowDate(row, "week"), availableHours: rowNumber(row, "availableHours"), usedHours: rowNumber(row, "usedHours") }));
  const exceptions: PlannerExceptionRow[] = exceptionRows.map((row) => ({ type: exceptionType(rowText(row, "type")), orderId: rowNullableText(row, "orderId"), detail: rowText(row, "detail") }));
  const costs = {
    production: metricNumberOrNaN(receipt, ["production cost"]),
    purchasing: metricNumberOrNaN(receipt, ["purchasing cost", "purchase cost"]),
    expedite: metricNumberOrNaN(receipt, ["expedite cost", "expediting cost"]),
    shipping: metricNumberOrNaN(receipt, ["shipping cost", "freight cost"]),
    holding: metricNumberOrNaN(receipt, ["holding cost", "inventory holding cost"]),
    total: metricNumberOrNaN(receipt, ["total cost", "plan total cost"]),
  };
  const dashboardViews = extractDashboardViews(receipt);
  const sheetTotals = {
    fulfilledUnits: metricNumberOrNaN(receipt, ["fulfillment total units"]),
    purchaseUnits: metricNumberOrNaN(receipt, ["purchase units"]),
    productionUnits: metricNumberOrNaN(receipt, ["production units"]),
    exceptionCount: metricNumberOrNaN(receipt, ["exceptions total"]),
    totalCost: metricNumberOrNaN(receipt, ["cost sheet total", "total cost"]),
  };
  return deepFreeze({
    schemaVersion: 1,
    sourceInputs: {
      schemaVersion: 1,
      horizonStart: rawCapacity.map(({ week }) => week).sort()[0] ?? "",
      horizonWeeks: 12 as const,
      orders: rawOrders,
      billOfMaterials: rawBom,
      inventory: rawInventory,
      suppliers: rawSuppliers,
      weeklyCapacity: rawCapacity,
      shippingOptions: rawShipping,
      products: rawProducts,
    },
    horizon: unique([...production.map(({ week }) => week), ...capacity.map(({ week }) => week)]).sort(),
    scenario,
    orderProjections,
    production,
    finishedGoods,
    components,
    purchases,
    capacity,
    exceptions,
    costs,
    dashboardViews,
    sheetTotals,
    formulas: formulaEvidence(receipt, derivedPlannerFormulaCells(receipt)),
    formulaErrors: formulaErrors(receipt),
  });
}

export function verifyProductionDeliveryPlannerModel(
  model: ProductionDeliveryPlannerWorkbookModel,
  inputs: ProductionDeliveryPlannerInputs = productionDeliveryPlannerInputs,
): readonly EvalCheck[] {
  const checks: EvalCheck[] = [];
  const add = (name: string, passed: boolean, detail: string): void => { checks.push({ name: `workspace:${name}`, passed, detail }); };
  const tolerance = 0.01;
  const productBySku = new Map(inputs.products.map((item) => [item.sku, item]));
  const supplierByComponent = new Map(inputs.suppliers.map((item) => [item.component, item]));
  const shippingByMode = new Map(inputs.shippingOptions.map((item) => [item.mode, item]));
  const expectedWeeks = inputs.weeklyCapacity.map(({ week }) => week);
  add("source-coverage", normalizedInputIdentity(model.sourceInputs) === normalizedInputIdentity(inputs), "Workbook source tables preserve every sealed order, BOM row, inventory balance, supplier term, capacity week, shipping option, and product economic input.");
  add("workbook-horizon", model.horizon.length === 12 && sameSet(model.horizon, expectedWeeks), `Observed ${model.horizon.length} week(s): ${model.horizon.join(", ")}.`);
  const scenarioValid = finitePositive(model.scenario.demandMultiplier)
    && finitePositive(model.scenario.capacityMultiplier)
    && Number.isInteger(model.scenario.supplierLeadTimeAdjustmentWeeks)
    && typeof model.scenario.expediteEnabled === "boolean";
  add("scenario-controls", scenarioValid, `Scenario ${JSON.stringify(model.scenario)}.`);
  const hasDerivedFormula = model.formulas.some(({ formula, derivedOutputCell }) => formula.trim().startsWith("=") && derivedOutputCell);
  add("formula-lineage", model.formulaErrors.length === 0 && hasDerivedFormula,
    `${model.formulas.length} formula cell(s); derived semantic formula ${hasDerivedFormula ? "present" : "missing"}; ${model.formulaErrors.length} formula error value(s).`);

  const projectionIds = model.orderProjections.map(({ orderId }) => orderId);
  const expectedOrderIds = inputs.orders.map(({ orderId }) => orderId);
  add("complete-order-coverage", projectionIds.length === expectedOrderIds.length && sameSet(projectionIds, expectedOrderIds), `Expected ${expectedOrderIds.join(", ")}; observed ${projectionIds.join(", ")}.`);
  const orderConservationFailures: string[] = [];
  for (const input of inputs.orders) {
    const projection = model.orderProjections.find(({ orderId }) => orderId === input.orderId);
    const requested = input.quantity * model.scenario.demandMultiplier;
    if (!projection || !close(projection.requestedQuantity, requested, tolerance)
      || !close(projection.fulfilledQuantity + projection.backorderQuantity, requested, tolerance)
      || projection.fulfilledQuantity < 0 || projection.backorderQuantity < 0 || projection.sku !== input.sku) orderConservationFailures.push(input.orderId);
  }
  add("order-conservation", orderConservationFailures.length === 0, orderConservationFailures.length ? `Order quantity mismatches: ${orderConservationFailures.join(", ")}.` : "Every order reconciles requested = fulfilled + backorder units.");

  const productionLookup = aggregate(model.production, ({ week, sku }) => `${week}|${sku}`, ({ quantity }) => quantity);
  const componentFailures: string[] = [];
  for (const row of model.components) {
    const expected = inputs.billOfMaterials.filter(({ component }) => component === row.component)
      .reduce((sum, bom) => sum + (productionLookup.get(`${row.week}|${bom.sku}`) ?? 0) * bom.quantityPerUnit, 0);
    if (!close(row.consumed, expected, tolerance) || !close(row.opening + row.receipts - row.consumed, row.closing, tolerance) || row.closing < -tolerance) componentFailures.push(`${row.week}/${row.component}`);
  }
  for (const component of inputs.inventory.filter(({ itemType }) => itemType === "component")) {
    const rows = model.components.filter((row) => row.component === component.item).sort(byWeek);
    if (rows.length !== 12 || !sameSet(rows.map(({ week }) => week), expectedWeeks)
      || !close(rows[0]?.opening ?? Number.NaN, component.quantityOnHand, tolerance)) componentFailures.push(`${component.item}/opening`);
    for (let index = 1; index < rows.length; index += 1) if (!close(rows[index]!.opening, rows[index - 1]!.closing, tolerance)) componentFailures.push(`${component.item}/week-${index + 1}`);
    for (const row of rows) {
      const purchased = model.purchases.filter((purchase) => purchase.component === component.item && horizonWeekForDate(purchase.receiptDate, expectedWeeks) === row.week)
        .reduce((total, purchase) => total + purchase.quantity, 0);
      if (!close(row.receipts, purchased, tolerance)) componentFailures.push(`${row.week}/${component.item}/receipts`);
    }
  }
  add("component-dependencies", componentFailures.length === 0, componentFailures.length ? `Component/BOM failures: ${unique(componentFailures).join(", ")}.` : "Component consumption and weekly inventory reconcile to BOM-driven production.");

  const fgFailures: string[] = [];
  for (const item of inputs.inventory.filter(({ itemType }) => itemType === "finished-good")) {
    const rows = model.finishedGoods.filter(({ sku }) => sku === item.item).sort(byWeek);
    if (rows.length !== 12 || !sameSet(rows.map(({ week }) => week), expectedWeeks)
      || !close(rows[0]?.opening ?? Number.NaN, item.quantityOnHand, tolerance)) fgFailures.push(`${item.item}/opening`);
    for (const row of rows) if (!close(row.opening + row.produced - row.shipped, row.closing, tolerance) || row.closing < -tolerance || !close(row.produced, productionLookup.get(`${row.week}|${row.sku}`) ?? 0, tolerance)) fgFailures.push(`${row.week}/${row.sku}`);
    for (let index = 1; index < rows.length; index += 1) if (!close(rows[index]!.opening, rows[index - 1]!.closing, tolerance)) fgFailures.push(`${item.item}/week-${index + 1}`);
    const shipped = sum(rows.map(({ shipped }) => shipped));
    const fulfilled = sum(model.orderProjections.filter(({ sku }) => sku === item.item).map(({ fulfilledQuantity }) => fulfilledQuantity));
    if (!close(shipped, fulfilled, tolerance)) fgFailures.push(`${item.item}/order-shipments`);
    for (const row of rows) {
      const projectedShipments = model.orderProjections.filter(({ sku, plannedShipDate }) => (
        sku === item.item && plannedShipDate !== null && horizonWeekForDate(plannedShipDate, expectedWeeks) === row.week
      )).reduce((total, projection) => total + projection.fulfilledQuantity, 0);
      if (!close(row.shipped, projectedShipments, tolerance)) fgFailures.push(`${row.week}/${item.item}/shipment-timing`);
    }
  }
  add("finished-goods-conservation", fgFailures.length === 0, fgFailures.length ? `Finished-goods failures: ${unique(fgFailures).join(", ")}.` : "Finished-goods opening, production, shipment, and closing quantities reconcile.");

  const capacityFailures: string[] = [];
  for (const product of inputs.products) {
    const rows = model.production.filter(({ sku }) => sku === product.sku);
    if (rows.length !== 12 || !sameSet(rows.map(({ week }) => week), expectedWeeks) || rows.some(({ quantity }) => quantity < -tolerance)) {
      capacityFailures.push(`${product.sku}/production-coverage`);
    }
  }
  for (const input of inputs.weeklyCapacity) {
    const expectedUsed = model.production.filter(({ week }) => week === input.week).reduce((sum, row) => sum + row.quantity * (productBySku.get(row.sku)?.productionHoursPerUnit ?? Number.NaN), 0);
    const row = model.capacity.find(({ week }) => week === input.week);
    const expectedAvailable = input.hours * model.scenario.capacityMultiplier;
    if (!row || !close(row.usedHours, expectedUsed, tolerance) || !close(row.availableHours, expectedAvailable, tolerance) || row.usedHours > row.availableHours + tolerance) capacityFailures.push(input.week);
  }
  add("weekly-capacity", capacityFailures.length === 0, capacityFailures.length ? `Capacity failures: ${capacityFailures.join(", ")}.` : "All twelve weeks reconcile production hours within scenario-adjusted capacity.");

  const purchaseFailures: string[] = [];
  for (const purchase of model.purchases) {
    const supplier = supplierByComponent.get(purchase.component);
    const adjustedLead = (purchase.expedited ? supplier?.expediteLeadTimeWeeks : supplier?.normalLeadTimeWeeks) ?? Number.NaN;
    const minimumReceipt = addDays(purchase.orderDate, (adjustedLead + model.scenario.supplierLeadTimeAdjustmentWeeks) * 7);
    if (!supplier || purchase.supplier !== supplier.supplier || purchase.quantity < 0
      || !close(purchase.unitCost, supplier.unitCost, tolerance)
      || !close(purchase.expeditePremiumPerUnit, purchase.expedited ? supplier.expeditePremiumPerUnit : 0, tolerance)
      || purchase.receiptDate < minimumReceipt || (purchase.expedited && !model.scenario.expediteEnabled)) purchaseFailures.push(`${purchase.component}/${purchase.receiptDate}`);
  }
  add("purchase-lead-times", purchaseFailures.length === 0, purchaseFailures.length ? `Purchase timing/cost failures: ${purchaseFailures.join(", ")}.` : "All purchase receipts respect supplier identity, costs, lead times, and expedite policy.");

  const dateFailures: string[] = [];
  for (const projection of model.orderProjections) {
    const input = inputs.orders.find(({ orderId }) => orderId === projection.orderId);
    if (!input) continue;
    if (projection.fulfilledQuantity > 0) {
      const shipping = projection.shippingMode === null ? undefined : shippingByMode.get(projection.shippingMode);
      if (!shipping || projection.plannedShipDate === null || projection.projectedDeliveryDate === null
        || projection.plannedShipDate < input.orderDate
        || projection.projectedDeliveryDate < addDays(projection.plannedShipDate, shipping?.transitDays ?? 0)
        || (projection.projectedDeliveryDate > input.requestedDeliveryDate && projection.status !== "late")
        || (projection.projectedDeliveryDate <= input.requestedDeliveryDate && projection.status === "late")) dateFailures.push(projection.orderId);
    }
    if ((projection.backorderQuantity > tolerance && projection.status !== "short" && projection.status !== "infeasible")
      || (projection.status === "infeasible" && projection.backorderQuantity <= tolerance)) dateFailures.push(`${projection.orderId}/status`);
  }
  add("fulfillment-dates", dateFailures.length === 0, dateFailures.length ? `Invalid ship/delivery projections: ${dateFailures.join(", ")}.` : "Ship and delivery dates respect order dates and selected transit times.");

  const exceptionOrderIds = new Set(model.exceptions.map(({ orderId }) => orderId).filter((value): value is string => value !== null));
  const missingExceptions = model.orderProjections.filter(({ status, backorderQuantity, orderId, projectedDeliveryDate }) => {
    const requested = inputs.orders.find((order) => order.orderId === orderId)?.requestedDeliveryDate;
    return (status !== "on-time" || backorderQuantity > tolerance || (requested !== undefined && projectedDeliveryDate !== null && projectedDeliveryDate > requested)) && !exceptionOrderIds.has(orderId);
  }).map(({ orderId }) => orderId);
  add("infeasible-exceptions", missingExceptions.length === 0 && model.exceptions.some(({ type }) => type === "infeasible" || type === "short"), missingExceptions.length ? `Missing exceptions for ${missingExceptions.join(", ")}.` : "Every late, short, or infeasible order is surfaced, including constrained demand.");

  const expectedProductionCost = model.production.reduce((sum, row) => sum + row.quantity * (productBySku.get(row.sku)?.productionCostPerUnit ?? Number.NaN), 0);
  const expectedPurchasingCost = model.purchases.reduce((sum, row) => sum + row.quantity * row.unitCost, 0);
  const expectedExpediteCost = model.purchases.reduce((sum, row) => sum + row.quantity * row.expeditePremiumPerUnit, 0);
  const expectedShippingCost = model.orderProjections.reduce((sum, row) => sum + row.fulfilledQuantity * (row.shippingMode === null ? 0 : shippingByMode.get(row.shippingMode)?.costPerUnit ?? Number.NaN), 0);
  const holdingByItem = new Map(inputs.inventory.map((item) => [item.item, item.holdingCostPerUnitWeek]));
  const expectedHoldingCost = model.finishedGoods.reduce((sum, row) => sum + row.closing * (holdingByItem.get(row.sku) ?? Number.NaN), 0)
    + model.components.reduce((sum, row) => sum + row.closing * (holdingByItem.get(row.component) ?? Number.NaN), 0);
  const expectedTotal = expectedProductionCost + expectedPurchasingCost + expectedExpediteCost + expectedShippingCost + expectedHoldingCost;
  const costsMatch = close(model.costs.production, expectedProductionCost, tolerance)
    && close(model.costs.purchasing, expectedPurchasingCost, tolerance)
    && close(model.costs.expedite, expectedExpediteCost, tolerance)
    && close(model.costs.shipping, expectedShippingCost, tolerance)
    && close(model.costs.holding, expectedHoldingCost, tolerance)
    && close(model.costs.total, expectedTotal, tolerance);
  add("cost-arithmetic", costsMatch, `Expected production ${money(expectedProductionCost)}, purchasing ${money(expectedPurchasingCost)}, expedite ${money(expectedExpediteCost)}, shipping ${money(expectedShippingCost)}, holding ${money(expectedHoldingCost)}, total ${money(expectedTotal)}; workbook total ${money(model.costs.total)}.`);

  const fulfilled = sum(model.orderProjections.map(({ fulfilledQuantity }) => fulfilledQuantity));
  const requested = sum(model.orderProjections.map(({ requestedQuantity }) => requestedQuantity));
  const productionUnits = sum(model.production.map(({ quantity }) => quantity));
  const purchaseUnits = sum(model.purchases.map(({ quantity }) => quantity));
  const dashboardMatches = model.dashboardViews.length > 0 && model.dashboardViews.every(({ summary, capacity, productionSignal }) => (
    dashboardProductionSignalMatches(productionSignal, model.production, expectedWeeks)
    && summary.totalOrders === inputs.orders.length
    && close(summary.unitsRequested, requested, tolerance)
    && close(summary.unitsFulfilled, fulfilled, tolerance)
    && summary.lateOrders === model.orderProjections.filter(({ status }) => status === "late").length
    && summary.exceptionCount === model.exceptions.length
    && close(summary.totalCost, model.costs.total, tolerance)
    && dashboardCapacitySignalMatches(capacity, model.capacity)
  ));
  const crossSheet = dashboardMatches
    && close(model.sheetTotals.fulfilledUnits, fulfilled, tolerance)
    && close(model.sheetTotals.productionUnits, productionUnits, tolerance)
    && close(model.sheetTotals.purchaseUnits, purchaseUnits, tolerance)
    && model.sheetTotals.exceptionCount === model.exceptions.length
    && close(model.sheetTotals.totalCost, model.costs.total, tolerance);
  add("cross-sheet-consistency", crossSheet, `Requested ${requested}, fulfilled ${fulfilled}, produced ${productionUnits}, purchased ${purchaseUnits}, exceptions ${model.exceptions.length}, ${model.dashboardViews.length} co-located dashboard view(s) ${dashboardMatches ? "reconcile service, cost, production, and capacity signals" : "are missing, conflicting, or stale"}; total ${money(model.costs.total)}.`);
  return deepFreeze(checks);
}

export interface PlannerScenarioProbeInput {
  readonly scenario: Pick<PlannerScenarioModel, "demandMultiplier" | "capacityMultiplier" | "supplierLeadTimeAdjustmentWeeks" | "expediteEnabled">;
  readonly capacity: readonly PlannerCapacityRow[];
  readonly sourceCapacity: readonly { readonly week: string; readonly hours: number }[];
}

export function scenarioMutationProbes(input: PlannerScenarioProbeInput): readonly PlannerInputMutation[] {
  const demand = input.scenario.demandMultiplier;
  const demandMultiplier = demand / 2;
  const sourceHoursByWeek = new Map(input.sourceCapacity.map(({ week, hours }) => [week, hours]));
  const peakUtilization = input.capacity.reduce((peak, row) => {
    const sourceHours = sourceHoursByWeek.get(row.week) ?? Number.NaN;
    return Number.isFinite(sourceHours) && sourceHours > 0 ? Math.max(peak, row.usedHours / sourceHours) : peak;
  }, 0);
  const capacityMultiplier = peakUtilization > 0
    ? Math.min(input.scenario.capacityMultiplier / 2, peakUtilization / 2)
    : input.scenario.capacityMultiplier / 2;
  return deepFreeze([
    { kind: "scenario-demand-multiplier", value: demandMultiplier },
    { kind: "scenario-capacity-multiplier", value: capacityMultiplier },
    { kind: "scenario-supplier-lead-time-adjustment", value: input.scenario.supplierLeadTimeAdjustmentWeeks + 1 },
    { kind: "scenario-expedite-enabled", value: !input.scenario.expediteEnabled },
  ]);
}

export async function gradeProductionDeliveryPlannerWorkspace(options: {
  readonly workspaceDirectory: string;
  readonly runtime: ProductionDeliveryPlannerRuntime | SpreadsheetRuntimeConfig;
  readonly baseRevision?: string;
  readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]> {
  const workbookPath = join(options.workspaceDirectory, PRODUCTION_DELIVERY_PLANNER_OUTPUT);
  const checks: EvalCheck[] = [];
  const runtime = isPlannerRuntime(options.runtime) ? options.runtime : createProductionDeliveryPlannerRuntime(options.runtime);
  const runtimeMatch = runtime.identity.id === productionDeliveryPlannerRuntimeContract.id
    && runtime.identity.environmentDigest === PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST
    && runtime.identity.artifactToolVersion.trim() !== ""
    && runtime.identity.nodeVersion.trim() !== "";
  checks.push({ name: "workspace:runtime-identity", passed: runtimeMatch, detail: `Runtime ${runtime.identity.id}, Node ${runtime.identity.nodeVersion}, artifact-tool ${runtime.identity.artifactToolVersion}, digest ${runtime.identity.environmentDigest}.` });
  let model: ProductionDeliveryPlannerWorkbookModel | null = null;
  try {
    await access(workbookPath);
    model = await runtime.extract(workbookPath);
    checks.push({ name: "workspace:workbook-parse", passed: true, detail: `${PRODUCTION_DELIVERY_PLANNER_OUTPUT} parsed through the injected spreadsheet runtime.` });
  } catch (error) {
    checks.push({ name: "workspace:workbook-parse", passed: false, detail: errorMessage(error) });
  }
  checks.push(...(model === null ? unavailableSemanticChecks("Workbook parsing failed.") : verifyProductionDeliveryPlannerModel(model)));

  try {
    const rendered = await runtime.render(workbookPath);
    const requiredRoles: PlannerRenderSheetEvidence["role"][] = ["inputs", "orders", "production", "inventory", "purchasing", "exceptions", "dashboard"];
    const failures = requiredRoles.filter((role) => !rendered.some((sheet) => sheet.role === role && sheet.readable && sheet.width >= 320 && sheet.height >= 180 && /^sha256:[a-f0-9]{64}$/.test(sheet.contentDigest)));
    checks.push({ name: "workspace:workbook-rendering", passed: failures.length === 0, detail: failures.length ? `Missing or unreadable rendered roles: ${failures.join(", ")}.` : `Rendered ${rendered.length} semantic workbook views with readable content.` });
  } catch (error) {
    checks.push({ name: "workspace:workbook-rendering", passed: false, detail: errorMessage(error) });
  }

  const mutations: readonly PlannerInputMutation[] = [
    { kind: "order-quantity", orderId: "ORD-1004", quantity: 35 },
    { kind: "order-quantity", orderId: "ORD-1004", quantity: 41 },
    { kind: "capacity-hours", week: weeks[3]!, hours: 35 },
    { kind: "capacity-hours", week: weeks[3]!, hours: 49 },
    { kind: "supplier-lead-time", component: "CMP-D", normalLeadTimeWeeks: 6 },
    { kind: "supplier-lead-time", component: "CMP-D", normalLeadTimeWeeks: 7 },
    ...(model === null ? [] : scenarioMutationProbes({
      scenario: model.scenario,
      capacity: model.capacity,
      sourceCapacity: model.sourceInputs.weeklyCapacity,
    })),
  ];
  if (model === null) {
    for (const kind of ["scenario-demand-multiplier", "scenario-capacity-multiplier", "scenario-supplier-lead-time-adjustment", "scenario-expedite-enabled"] as const) {
      checks.push({ name: `workspace:changed-${kind}`, passed: false, detail: "Scenario probe unavailable because workbook parsing failed." });
    }
  }
  const mutationOccurrences = new Map<string, number>();
  for (const mutation of mutations) {
    const occurrence = (mutationOccurrences.get(mutation.kind) ?? 0) + 1;
    mutationOccurrences.set(mutation.kind, occurrence);
    const checkPrefix = mutation.kind.startsWith("scenario-") ? "workspace:changed-" : "workspace:changed-input-";
    const checkName = `${checkPrefix}${mutation.kind}${occurrence === 1 ? "" : `-boundary-${occurrence}`}`;
    try {
      const changed = await runtime.recalculateWithMutation(workbookPath, mutation);
      const responsive = model !== null && changedInputResponded(model, changed, mutation);
      checks.push({ name: checkName, passed: responsive, detail: responsive ? `${mutation.kind} boundary ${occurrence} changed dependent semantic outputs and preserved every semantic predicate after recalculation.` : `${mutation.kind} boundary ${occurrence} did not change the required dependent outputs while preserving global consistency.` });
    } catch (error) {
      checks.push({ name: checkName, passed: false, detail: errorMessage(error) });
    }
  }

  const runCommand = options.runCommand ?? run;
  try {
    const baseRevision = options.baseRevision ?? (await required(runCommand, "git", ["rev-list", "--max-parents=0", "HEAD"], options.workspaceDirectory)).stdout.trim();
    const status = (await required(runCommand, "git", ["status", "--porcelain=v1", "--untracked-files=all"], options.workspaceDirectory)).stdout.trim();
    const changed = (await required(runCommand, "git", ["diff", "--name-only", `${baseRevision}..HEAD`, "--"], options.workspaceDirectory)).stdout.split("\n").map((line) => line.trim()).filter(Boolean);
    const commits = (await required(runCommand, "git", ["rev-list", `${baseRevision}..HEAD`], options.workspaceDirectory)).stdout.split("\n").filter(Boolean);
    checks.push({ name: "workspace:required-workbook", passed: changed.includes(PRODUCTION_DELIVERY_PLANNER_OUTPUT), detail: `Committed paths: ${changed.join(", ") || "none"}.` });
    checks.push({ name: "workspace:delivery-commit", passed: commits.length >= 1, detail: `${commits.length} post-fixture commit(s).` });
    checks.push({ name: "workspace:delivery-clean", passed: status === "", detail: status === "" ? "The workspace is clean." : `Uncommitted changes remain: ${status}` });
  } catch (error) {
    for (const name of ["required-workbook", "delivery-commit", "delivery-clean"]) checks.push({ name: `workspace:${name}`, passed: false, detail: errorMessage(error) });
  }
  return deepFreeze(checks);
}

type SemanticColumns = Readonly<Record<string, readonly string[]>>;
type SemanticRow = Readonly<Record<string, unknown>>;
interface LocatedSemanticTable {
  readonly sheet: SpreadsheetSheetSnapshot;
  readonly headerRow: number;
  readonly headers: Readonly<Record<string, { readonly index: number; readonly text: string }>>;
  readonly rows: readonly SemanticRow[];
  readonly sourceRows: readonly (readonly unknown[])[];
  readonly sourceRowIndexes: readonly number[];
  readonly formulaRowIndexes: readonly number[];
}

const orderProjectionColumns: SemanticColumns = deepFreeze({
  orderId: ["order id", "order number"], sku: ["sku", "product sku", "item"],
  requestedQuantity: ["requested quantity", "requested qty", "demand units"],
  fulfilledQuantity: ["fulfilled quantity", "fulfilled qty", "planned fulfillment units"],
  backorderQuantity: ["backorder quantity", "backorder qty", "short units", "unfulfilled units"],
  plannedShipDate: ["planned ship date", "ship date"], projectedDeliveryDate: ["projected delivery date", "delivery projection", "planned delivery date"],
  shippingMode: ["shipping mode", "ship mode"], status: ["status", "fulfillment status"],
});
const productionColumns: SemanticColumns = deepFreeze({ week: ["week", "week start", "production week"], sku: ["sku", "product sku"], quantity: ["production quantity", "production qty", "units produced", "planned production"] });
const finishedGoodsColumns: SemanticColumns = deepFreeze({ week: ["week", "week start"], sku: ["sku", "product sku"], opening: ["opening inventory", "opening fg inventory", "beginning inventory"], produced: ["produced", "production receipts", "units produced"], shipped: ["shipped", "shipments", "units shipped"], closing: ["closing inventory", "ending inventory", "closing fg inventory"] });
const componentColumns: SemanticColumns = deepFreeze({ week: ["week", "week start"], component: ["component", "component id", "component sku"], opening: ["opening inventory", "beginning inventory", "opening component inventory"], receipts: ["receipts", "purchase receipts", "received"], consumed: ["consumed", "component consumption", "usage"], closing: ["closing inventory", "ending inventory", "closing component inventory"] });
const purchaseColumns: SemanticColumns = deepFreeze({ component: ["component", "component id"], supplier: ["supplier", "supplier name"], quantity: ["purchase quantity", "purchase qty", "order quantity"], orderDate: ["purchase order date", "order date", "po date"], receiptDate: ["receipt date", "planned receipt date"], expedited: ["expedited", "expedite", "expedite decision"], unitCost: ["unit cost", "purchase unit cost"], expeditePremiumPerUnit: ["expedite premium per unit", "expedite premium", "expedite unit premium"] });
const capacityColumns: SemanticColumns = deepFreeze({ week: ["week", "week start"], availableHours: ["available hours", "capacity hours", "scenario capacity hours"], usedHours: ["used hours", "production hours", "required hours"] });
const exceptionColumns: SemanticColumns = deepFreeze({ type: ["exception type", "type"], orderId: ["order id", "order number"], detail: ["detail", "exception detail", "reason"] });
const rawOrderColumns: SemanticColumns = deepFreeze({ orderId: ["order id", "order number"], customer: ["customer", "customer name"], sku: ["sku", "product sku"], quantity: ["quantity", "order quantity", "ordered units"], orderDate: ["order date"], requestedDeliveryDate: ["requested delivery date", "due date"], priority: ["priority", "order priority"] });

const derivedPlannerTableBindings: readonly { readonly columns: SemanticColumns; readonly keys: readonly string[]; readonly allowEmpty?: boolean }[] = [
  { columns: orderProjectionColumns, keys: ["requestedQuantity", "fulfilledQuantity", "backorderQuantity", "plannedShipDate", "projectedDeliveryDate", "status"] },
  { columns: productionColumns, keys: ["quantity"] },
  { columns: finishedGoodsColumns, keys: ["opening", "produced", "shipped", "closing"] },
  { columns: componentColumns, keys: ["opening", "receipts", "consumed", "closing"] },
  { columns: purchaseColumns, keys: ["receiptDate", "expedited", "expeditePremiumPerUnit"] },
  { columns: capacityColumns, keys: ["availableHours", "usedHours"] },
  { columns: exceptionColumns, keys: ["type", "orderId", "detail"], allowEmpty: true },
];

function plannerFormulaCellKey(sheetName: string, rowIndex: number, columnIndex: number): string {
  return `${sheetName}\u0000${rowIndex}\u0000${columnIndex}`;
}

function derivedPlannerFormulaCells(receipt: SpreadsheetWorkbookReceipt): ReadonlySet<string> {
  const cells = new Set<string>();
  for (const binding of derivedPlannerTableBindings) {
    const table = tryLocateSemanticTable(receipt, binding.columns, binding.allowEmpty ?? false);
    if (!table) continue;
    for (const rowIndex of new Set([...table.sourceRowIndexes, ...table.formulaRowIndexes])) {
      for (const key of binding.keys) {
        const columnIndex = table.headers[key]?.index;
        if (columnIndex !== undefined) cells.add(plannerFormulaCellKey(table.sheet.name, rowIndex, columnIndex));
      }
    }
  }
  return cells;
}
const scenarioControlAliases = deepFreeze({
  demandMultiplier: ["demand multiplier", "demand factor"],
  capacityMultiplier: ["capacity multiplier", "capacity factor"],
  supplierLeadTimeAdjustmentWeeks: ["supplier lead time adjustment weeks", "lead time adjustment weeks", "lead time adjustment"],
  expediteEnabled: ["expedite enabled", "allow expedite", "expedite policy"],
});
const rawCapacityColumns: SemanticColumns = deepFreeze({ week: ["week", "week start"], hours: ["hours", "capacity hours", "weekly hours"] });
const rawSupplierColumns: SemanticColumns = deepFreeze({ component: ["component", "component id"], supplier: ["supplier", "supplier name"], normalLeadTimeWeeks: ["normal lead time weeks", "lead time weeks", "normal lead time"], expediteLeadTimeWeeks: ["expedite lead time weeks", "expedited lead time weeks"], unitCost: ["unit cost", "purchase unit cost"], expeditePremiumPerUnit: ["expedite premium per unit", "expedite premium"] });
const bomColumns: SemanticColumns = deepFreeze({ sku: ["sku", "product sku"], component: ["component", "component id"], quantityPerUnit: ["quantity per unit", "qty per unit", "bom quantity"] });
const rawInventoryColumns: SemanticColumns = deepFreeze({ item: ["item", "item id"], itemType: ["item type", "type"], quantityOnHand: ["quantity on hand", "on hand", "opening quantity"], holdingCostPerUnitWeek: ["holding cost per unit week", "weekly holding cost"] });
const rawShippingColumns: SemanticColumns = deepFreeze({ mode: ["mode", "shipping mode"], transitDays: ["transit days", "shipping days"], costPerUnit: ["cost per unit", "shipping cost per unit"] });
const rawProductColumns: SemanticColumns = deepFreeze({ sku: ["sku", "product sku"], productionHoursPerUnit: ["production hours per unit", "hours per unit"], productionCostPerUnit: ["production cost per unit", "manufacturing cost per unit"] });

function plannerSpreadsheetMutation(receipt: SpreadsheetWorkbookReceipt, mutation: PlannerInputMutation): SpreadsheetSemanticMutation {
  if (mutation.kind === "order-quantity") {
    const table = locateSemanticTable(receipt, rawOrderColumns);
    return tableMutation(table, "orderId", mutation.orderId, "quantity", mutation.quantity);
  }
  if (mutation.kind === "capacity-hours") {
    const table = locateSemanticTable(receipt, rawCapacityColumns);
    return tableMutation(table, "week", mutation.week, "hours", mutation.hours);
  }
  if (mutation.kind === "supplier-lead-time") {
    const table = locateSemanticTable(receipt, rawSupplierColumns);
    return tableMutation(table, "component", mutation.component, "normalLeadTimeWeeks", mutation.normalLeadTimeWeeks);
  }
  const labels = mutation.kind === "scenario-demand-multiplier" ? scenarioControlAliases.demandMultiplier
    : mutation.kind === "scenario-capacity-multiplier" ? scenarioControlAliases.capacityMultiplier
      : mutation.kind === "scenario-supplier-lead-time-adjustment" ? scenarioControlAliases.supplierLeadTimeAdjustmentWeeks
        : scenarioControlAliases.expediteEnabled;
  return { kind: "label-value", labels, value: mutation.value };
}

function tableMutation(table: LocatedSemanticTable, key: string, desiredKey: string, target: string, value: number | boolean): SpreadsheetSemanticMutation {
  const keyColumn = table.headers[key]!;
  const targetColumn = table.headers[target]!;
  const sourceIndex = table.rows.findIndex((row) => comparableText(row[key]) === comparableText(desiredKey));
  if (sourceIndex < 0) throw new Error(`Could not find ${desiredKey} in semantic input column ${keyColumn.text}.`);
  const sourceValue = table.sourceRows[sourceIndex]?.[keyColumn.index];
  if (!isSpreadsheetScalar(sourceValue)) throw new Error(`Semantic input key ${desiredKey} is not a scalar workbook value.`);
  return {
    kind: "table-cell",
    sheetName: table.sheet.name,
    keyHeader: keyColumn.text,
    keyValue: sourceValue,
    targetHeader: targetColumn.text,
    value,
  };
}

function plannerRenderEvidence(receipt: SpreadsheetWorkbookReceipt): readonly PlannerRenderSheetEvidence[] {
  const dashboardViews = extractDashboardViews(receipt);
  const roles: Array<{ readonly role: PlannerRenderSheetEvidence["role"]; readonly sheetName: string | null }> = [
    { role: "inputs", sheetName: tryLocateSemanticTable(receipt, rawOrderColumns)?.sheet.name ?? tryLocateSemanticTable(receipt, bomColumns)?.sheet.name ?? null },
    { role: "orders", sheetName: tryLocateSemanticTable(receipt, orderProjectionColumns)?.sheet.name ?? null },
    { role: "production", sheetName: tryLocateSemanticTable(receipt, productionColumns)?.sheet.name ?? null },
    { role: "inventory", sheetName: tryLocateSemanticTable(receipt, componentColumns)?.sheet.name ?? tryLocateSemanticTable(receipt, finishedGoodsColumns)?.sheet.name ?? null },
    { role: "purchasing", sheetName: tryLocateSemanticTable(receipt, purchaseColumns)?.sheet.name ?? null },
    { role: "exceptions", sheetName: tryLocateSemanticTable(receipt, exceptionColumns, true)?.sheet.name ?? null },
    ...dashboardViews.map(({ sheetName }) => ({ role: "dashboard" as const, sheetName })),
  ];
  return deepFreeze(roles.flatMap(({ role, sheetName }) => {
    if (sheetName === null) return [];
    const render = receipt.renders.find((candidate) => candidate.sheetName === sheetName);
    if (!render) return [];
    return [{ role, sheetName, contentDigest: render.contentDigest, width: render.width, height: render.height, readable: render.byteLength >= 1_000 && render.width > 0 && render.height > 0 }];
  }));
}

function semanticRowsOrEmpty(receipt: SpreadsheetWorkbookReceipt, columns: SemanticColumns, allowEmpty = false): readonly SemanticRow[] {
  return tryLocateSemanticTable(receipt, columns, allowEmpty)?.rows ?? [];
}

function tryLocateSemanticTable(receipt: SpreadsheetWorkbookReceipt, columns: SemanticColumns, allowEmpty = false): LocatedSemanticTable | null {
  try { return locateSemanticTable(receipt, columns, allowEmpty); } catch { return null; }
}

function locateSemanticTable(receipt: SpreadsheetWorkbookReceipt, columns: SemanticColumns, allowEmpty = false): LocatedSemanticTable {
  const candidates: LocatedSemanticTable[] = [];
  for (const sheet of receipt.sheets) {
    for (const [headerRow, row] of sheet.values.entries()) {
      const headers: Record<string, { index: number; text: string }> = {};
      for (const [semanticKey, aliases] of Object.entries(columns)) {
        const index = row.findIndex((cell) => aliases.includes(normalizeHeader(cell)));
        if (index < 0) break;
        headers[semanticKey] = { index, text: String(row[index] ?? "").trim() };
      }
      if (Object.keys(headers).length !== Object.keys(columns).length) continue;
      const sourceRows: (readonly unknown[])[] = [];
      const sourceRowIndexes: number[] = [];
      const formulaRowIndexes: number[] = [];
      let tableDataStarted = false;
      for (const [offset, sourceRow] of sheet.values.slice(headerRow + 1).entries()) {
        const sourceRowIndex = headerRow + offset + 1;
        const isBlank = allowEmpty
          ? Object.values(headers).every(({ index }) => sourceRow[index] === null || sourceRow[index] === undefined || String(sourceRow[index]).trim() === "")
          : sourceRow.every((cell) => cell === null || cell === undefined || String(cell).trim() === "");
        const hasSemanticFormula = allowEmpty && Object.values(headers).some(({ index }) => {
          const formula = sheet.formulas[sourceRowIndex]?.[index];
          return typeof formula === "string" && formula.trim().startsWith("=");
        });
        if (!isBlank || hasSemanticFormula) tableDataStarted = true;
        if (allowEmpty && hasSemanticFormula) formulaRowIndexes.push(sourceRowIndex);
        if (isBlank && !hasSemanticFormula) {
          if (allowEmpty && !tableDataStarted) continue;
          if (allowEmpty) break;
          break;
        }
        if (isBlank) continue;
        sourceRows.push(sourceRow);
        sourceRowIndexes.push(sourceRowIndex);
      }
      const rows = sourceRows.map((sourceRow) => Object.fromEntries(Object.entries(headers).map(([semanticKey, header]) => [semanticKey, sourceRow[header.index]])));
      if (allowEmpty || rows.length > 0) candidates.push({ sheet, headerRow, headers, rows, sourceRows, sourceRowIndexes, formulaRowIndexes });
    }
  }
  candidates.sort((left, right) => right.rows.length - left.rows.length || Object.keys(right.headers).length - Object.keys(left.headers).length);
  const selected = candidates[0];
  if (!selected) throw new Error(`Workbook does not contain a semantic table with headers ${Object.values(columns).map((aliases) => aliases[0]).join(", ")}.`);
  return selected;
}

export function dashboardProductionSignalMatches(
  signal: readonly { readonly week: string; readonly units: number }[] | null,
  production: readonly PlannerProductionRow[],
  horizonWeeks: readonly string[],
): boolean {
  if (signal === null) return true;
  const horizon = new Set(horizonWeeks);
  if (signal.length === 0 || signal.length > horizon.size
    || new Set(signal.map(({ week }) => week)).size !== signal.length
    || signal.some(({ week }) => !horizon.has(week))) return false;
  const productionTotals = aggregate(production, ({ week }) => week, ({ quantity }) => quantity);
  return signal.every(({ week, units }) => close(units, productionTotals.get(week) ?? Number.NaN, 0.01));
}

function extractDashboardViews(receipt: SpreadsheetWorkbookReceipt): readonly PlannerDashboardView[] {
  return deepFreeze(receipt.sheets.flatMap((sheet) => {
    const totalOrders = dashboardMetric(sheet, ["total orders", "order count"]);
    const unitsRequested = dashboardMetric(sheet, ["units requested", "requested units", "total demand"]);
    const unitsFulfilled = dashboardMetric(sheet, ["units fulfilled", "fulfilled units", "shipped units"]);
    const lateOrders = dashboardMetric(sheet, ["late orders", "late order count"]);
    const exceptionCount = dashboardMetric(sheet, ["exception count", "total exceptions"]);
    const totalCost = dashboardMetric(sheet, ["management total cost", "dashboard total cost", "total cost"]);
    const summary = [totalOrders, unitsRequested, unitsFulfilled, lateOrders, exceptionCount, totalCost];
    if (summary.some(({ present }) => !present)) return [];

    const usedHours = dashboardMetric(sheet, ["capacity used hours", "used capacity hours", "production hours used", "used hours"]);
    const availableHours = dashboardMetric(sheet, ["capacity available hours", "available capacity hours", "available hours"]);
    const utilizationField = dashboardUtilizationMetric(sheet);
    const utilization = utilizationField.value;
    const hasHoursPair = usedHours.present && availableHours.present;
    const hasUtilization = utilizationField.present;
    if (!hasHoursPair && !hasUtilization && !usedHours.present && !availableHours.present) return [];
    return [{
      sheetName: sheet.name,
      summary: {
        totalOrders: totalOrders.value ?? Number.NaN,
        unitsRequested: unitsRequested.value ?? Number.NaN,
        unitsFulfilled: unitsFulfilled.value ?? Number.NaN,
        lateOrders: lateOrders.value ?? Number.NaN,
        exceptionCount: exceptionCount.value ?? Number.NaN,
        totalCost: totalCost.value ?? Number.NaN,
      },
      capacity: {
        usedHours: usedHours.present ? usedHours.value ?? Number.NaN : null,
        availableHours: availableHours.present ? availableHours.value ?? Number.NaN : null,
        utilization: hasUtilization ? utilization ?? Number.NaN : null,
      },
      productionSignal: extractDashboardProductionSignal(sheet),
    }];
  }));
}

function dashboardMetric(sheet: SpreadsheetSheetSnapshot, aliases: readonly string[]): { readonly present: boolean; readonly value: number | null } {
  const values = metricValuesOnSheet(sheet, aliases).map(numericValue);
  if (values.length === 0) return { present: false, value: null };
  if (values.some((value) => !Number.isFinite(value)) || !values.every((value) => close(value, values[0]!, 0.01))) return { present: true, value: null };
  return { present: true, value: values[0]! };
}

function dashboardUtilizationMetric(sheet: SpreadsheetSheetSnapshot): { readonly present: boolean; readonly value: number | null } {
  const fractionAliases = ["capacity utilization", "capacity utilization rate", "utilization rate", "utilization"];
  const percentAliases = ["capacity used percent", "capacity utilization percent", "utilization percent"];
  const values: number[] = [];
  let present = false;
  for (const { label, raw } of dashboardLabelValues(sheet)) {
    const normalized = normalizeHeader(label);
    const isPercentLabel = percentAliases.includes(normalized);
    if (!isPercentLabel && !fractionAliases.includes(normalized)) continue;
    present = true;
    const hasPercentSuffix = typeof raw === "string" && raw.trim().endsWith("%");
    const parsed = numericValue(raw);
    values.push(isPercentLabel && !hasPercentSuffix ? parsed / 100 : parsed);
  }
  if (!present) return { present: false, value: null };
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))
    || !values.every((value) => close(value, values[0]!, 0.001))) return { present: true, value: null };
  return { present: true, value: values[0]! };
}

function metricValuesOnSheet(sheet: SpreadsheetSheetSnapshot, aliases: readonly string[]): readonly unknown[] {
  const normalizedAliases = aliases.map(normalizeHeader);
  return dashboardLabelValues(sheet).filter(({ label }) => normalizedAliases.includes(normalizeHeader(label))).map(({ raw }) => raw);
}

function dashboardLabelValues(sheet: SpreadsheetSheetSnapshot): readonly { readonly label: unknown; readonly raw: unknown }[] {
  const pairs: { label: unknown; raw: unknown }[] = [];
  const structurallyBoundLabelCells = new Set<string>();
  const cellKey = (row: number, column: number) => `${row}:${column}`;
  const add = (label: unknown, raw: unknown) => {
    if (label === null || label === undefined || String(label).trim() === ""
      || raw === null || raw === undefined || String(raw).trim() === "") return false;
    pairs.push({ label, raw });
    return true;
  };
  for (const [rowIndex, row] of sheet.values.entries()) {
    const metricColumn = row.findIndex((value) => normalizeHeader(value) === "metric");
    const valueColumn = row.findIndex((value) => normalizeHeader(value) === "value");
    if (metricColumn >= 0 && valueColumn >= 0) {
      for (const [offset, dataRow] of sheet.values.slice(rowIndex + 1).entries()) {
        const dataRowIndex = rowIndex + offset + 1;
        if (add(dataRow[metricColumn], dataRow[valueColumn])) structurallyBoundLabelCells.add(cellKey(dataRowIndex, metricColumn));
      }
    }
  }
  const width = Math.max(0, ...sheet.values.map((row) => row.length));
  for (let markerColumn = 0; markerColumn < width; markerColumn += 1) {
    for (let metricRowIndex = 0; metricRowIndex < sheet.values.length; metricRowIndex += 1) {
      if (normalizeHeader(sheet.values[metricRowIndex]?.[markerColumn]) !== "metric") continue;
      const valueRowIndex = sheet.values.findIndex((row, index) => index > metricRowIndex
        && normalizeHeader(row[markerColumn]) === "value");
      if (valueRowIndex < 0) continue;
      const metricRow = sheet.values[metricRowIndex] ?? [];
      const valueRow = sheet.values[valueRowIndex] ?? [];
      for (let column = 0; column < width; column += 1) {
        if (add(metricRow[column], valueRow[column])) structurallyBoundLabelCells.add(cellKey(metricRowIndex, column));
      }
    }
  }
  for (const [rowIndex, row] of sheet.values.entries()) {
    for (const [columnIndex, label] of row.entries()) {
      const normalized = normalizeHeader(label);
      if (["metric", "value"].includes(normalized)) continue;
      if (structurallyBoundLabelCells.has(cellKey(rowIndex, columnIndex))) continue;
      let associated: unknown = null;
      for (let offset = 1; offset <= 3; offset += 1) {
        const candidate = row[columnIndex + offset];
        if (candidate !== null && candidate !== undefined && String(candidate).trim() !== "") { associated = candidate; break; }
      }
      if (associated === null) {
        for (let offset = 1; offset <= 3; offset += 1) {
          const candidate = sheet.values[rowIndex + offset]?.[columnIndex];
          if (candidate !== null && candidate !== undefined && String(candidate).trim() !== "") { associated = candidate; break; }
        }
      }
      if (associated !== null) add(label, associated);
    }
  }
  return pairs;
}

function dashboardCapacitySignalMatches(
  signal: PlannerDashboardView["capacity"],
  capacity: readonly PlannerCapacityRow[],
): boolean {
  const used = sum(capacity.map(({ usedHours }) => usedHours));
  const available = sum(capacity.map(({ availableHours }) => availableHours));
  if (signal.usedHours !== null && !close(signal.usedHours, used, 0.01)) return false;
  if (signal.availableHours !== null && !close(signal.availableHours, available, 0.01)) return false;
  if (signal.utilization !== null) {
    if (available <= 0 || signal.utilization > 1) return false;
    if (!close(signal.utilization, used / available, 0.001)) return false;
  }
  return (signal.usedHours !== null && signal.availableHours !== null) || signal.utilization !== null;
}

function extractDashboardProductionSignal(dashboard: SpreadsheetSheetSnapshot): readonly { readonly week: string; readonly units: number }[] | null {
  for (const [headerIndex, row] of dashboard.values.entries()) {
    const weekColumn = row.findIndex((value) => normalizeHeader(value) === "week");
    const unitsColumn = row.findIndex((value) => ["production units", "units produced", "weekly production units"].includes(normalizeHeader(value)));
    if (weekColumn < 0 || unitsColumn < 0) continue;
    const signal: { week: string; units: number }[] = [];
    for (const values of dashboard.values.slice(headerIndex + 1)) {
      const week = values[weekColumn];
      const units = values[unitsColumn];
      if ((week === null || week === undefined || String(week).trim() === "")
        && (units === null || units === undefined || String(units).trim() === "")) break;
      signal.push({ week: rowDate({ week }, "week"), units: numericValue(units) });
    }
    return deepFreeze(signal);
  }
  return null;
}

function formulaEvidence(receipt: SpreadsheetWorkbookReceipt, derivedCells: ReadonlySet<string>): readonly PlannerFormulaEvidence[] {
  const evidence: PlannerFormulaEvidence[] = [];
  for (const sheet of receipt.sheets) {
    for (const [rowIndex, row] of sheet.formulas.entries()) {
      for (const [columnIndex, formulaValue] of row.entries()) {
        const formula = typeof formulaValue === "string" ? formulaValue.trim() : "";
        if (!formula.startsWith("=")) continue;
        const header = nearestHeader(sheet, rowIndex, columnIndex);
        const references = formula.match(/(?:'[^']+'|[A-Za-z0-9_ ]+)?!?(?:\$?[A-Z]{1,3}\$?\d+)/g) ?? [];
        evidence.push({
          semanticRole: `${sheet.name}:${header}`,
          formula,
          precedentRoles: unique(references),
          derivedOutputCell: derivedCells.has(plannerFormulaCellKey(sheet.name, rowIndex, columnIndex)),
        });
      }
    }
  }
  return evidence;
}

function formulaErrors(receipt: SpreadsheetWorkbookReceipt): readonly string[] {
  const errors: string[] = [];
  for (const sheet of receipt.sheets) {
    for (const [rowIndex, row] of sheet.formulas.entries()) {
      for (const [columnIndex, formulaValue] of row.entries()) {
        if (typeof formulaValue !== "string" || !formulaValue.trim().startsWith("=")) continue;
        const calculatedValue = sheet.values[rowIndex]?.[columnIndex];
        if (typeof calculatedValue === "string" && /^#(?:DIV\/0!|N\/A|NAME\?|NULL!|NUM!|REF!|SPILL!|VALUE!)$/i.test(calculatedValue.trim())) {
          errors.push(`${sheet.name}!R${rowIndex + 1}C${columnIndex + 1}:${calculatedValue.trim()}`);
        }
      }
    }
  }
  return errors;
}

function nearestHeader(sheet: SpreadsheetSheetSnapshot, rowIndex: number, columnIndex: number): string {
  for (let row = rowIndex - 1; row >= 0; row -= 1) {
    const value = sheet.values[row]?.[columnIndex];
    if (typeof value === "string" && value.trim() !== "") return normalizeHeader(value);
  }
  return `column-${columnIndex + 1}`;
}

function metricNumber(receipt: SpreadsheetWorkbookReceipt, aliases: readonly string[]): number {
  const value = metricValue(receipt, aliases).value;
  return numericValue(value);
}

function metricNumberOrNaN(receipt: SpreadsheetWorkbookReceipt, aliases: readonly string[]): number {
  try { return metricNumber(receipt, aliases); } catch { return Number.NaN; }
}

function metricBoolean(receipt: SpreadsheetWorkbookReceipt, aliases: readonly string[]): boolean {
  const value = metricValue(receipt, aliases).value;
  if (typeof value === "boolean") return value;
  return ["true", "yes", "enabled", "allow", "on", "1"].includes(normalizeHeader(value));
}

function metricBooleanOrFalse(receipt: SpreadsheetWorkbookReceipt, aliases: readonly string[]): boolean {
  try { return metricBoolean(receipt, aliases); } catch { return false; }
}

function metricValue(receipt: SpreadsheetWorkbookReceipt, aliases: readonly string[]): { readonly value: unknown; readonly sheetName: string } {
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const sheet of receipt.sheets) {
    for (const row of sheet.values) {
      for (const [index, cell] of row.entries()) {
        if (!normalizedAliases.includes(normalizeHeader(cell))) continue;
        for (let offset = 1; offset <= 3; offset += 1) {
          const value = row[index + offset];
          if (value !== null && value !== undefined && String(value).trim() !== "") return { value, sheetName: sheet.name };
        }
      }
    }
  }
  throw new Error(`Workbook does not expose metric ${aliases[0] ?? "unknown"}.`);
}

function rowText(row: SemanticRow, key: string): string { return String(row[key] ?? "").trim(); }
function rowNullableText(row: SemanticRow, key: string): string | null { const value = rowText(row, key); return value === "" ? null : value; }
function rowNumber(row: SemanticRow, key: string): number { return numericValue(row[key]); }
function rowBoolean(row: SemanticRow, key: string): boolean { const value = row[key]; return typeof value === "boolean" ? value : ["true", "yes", "y", "1", "expedite", "expedited"].includes(normalizeHeader(value)); }
function rowDate(row: SemanticRow, key: string): string { return dateValue(row[key]); }
function rowNullableDate(row: SemanticRow, key: string): string | null { const value = row[key]; return value === null || value === undefined || String(value).trim() === "" ? null : dateValue(value); }
function numericValue(value: unknown): number { if (typeof value === "number") return value; const text = String(value ?? "").trim().replaceAll(/[$,]/g, ""); return text.endsWith("%") ? Number(text.slice(0, -1)) / 100 : Number(text); }
function dateValue(value: unknown): string { if (typeof value === "number" && Number.isFinite(value)) return new Date(Date.UTC(1899, 11, 30 + value)).toISOString().slice(0, 10); const text = String(value ?? "").trim(); const parsed = new Date(text); return Number.isNaN(parsed.valueOf()) ? text : parsed.toISOString().slice(0, 10); }
function plannerStatus(value: string): PlannerOrderProjection["status"] { const normalized = normalizeHeader(value); if (normalized.includes("infeasible")) return "infeasible"; if (normalized.includes("short") || normalized.includes("backorder")) return "short"; if (normalized.includes("late")) return "late"; return "on-time"; }
function exceptionType(value: string): PlannerExceptionRow["type"] { const normalized = normalizeHeader(value); if (normalized.includes("capacity")) return "capacity"; if (normalized.includes("component") || normalized.includes("material")) return "component"; if (normalized.includes("infeasible")) return "infeasible"; if (normalized.includes("short") || normalized.includes("backorder")) return "short"; return "late"; }
function normalizeHeader(value: unknown): string { return String(value ?? "").trim().toLowerCase().replaceAll(/[^a-z0-9]+/g, " ").trim(); }
function comparableText(value: unknown): string { return dateValue(value).toLowerCase(); }
function isSpreadsheetScalar(value: unknown): value is string | number | boolean | null { return value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value)); }
function isPlannerRuntime(value: ProductionDeliveryPlannerRuntime | SpreadsheetRuntimeConfig): value is ProductionDeliveryPlannerRuntime { return "extract" in value && typeof value.extract === "function"; }

function changedInputResponded(base: ProductionDeliveryPlannerWorkbookModel, changed: ProductionDeliveryPlannerWorkbookModel, mutation: PlannerInputMutation): boolean {
  const mutatedInputs = inputsAfterMutation(mutation);
  if (!verifyProductionDeliveryPlannerModel(changed, mutatedInputs).every(({ passed }) => passed)) return false;
  if (mutation.kind === "scenario-demand-multiplier") {
    return close(changed.scenario.demandMultiplier, mutation.value, 0.01)
      && changed.orderProjections.every((projection) => {
        const input = mutatedInputs.orders.find(({ orderId }) => orderId === projection.orderId);
        return input !== undefined && close(projection.requestedQuantity, input.quantity * mutation.value, 0.01);
      })
      && changed.orderProjections.some((projection) => projection.requestedQuantity !== base.orderProjections.find(({ orderId }) => orderId === projection.orderId)?.requestedQuantity);
  }
  if (mutation.kind === "scenario-capacity-multiplier") {
    return close(changed.scenario.capacityMultiplier, mutation.value, 0.01)
      && (sum(base.production.map(({ quantity }) => quantity)) <= 0 || base.capacity.some((before) => {
        const after = changed.capacity.find(({ week }) => week === before.week);
        return after !== undefined && before.usedHours > after.availableHours + 0.01;
      }))
      && changed.capacity.every((row) => {
        const input = mutatedInputs.weeklyCapacity.find(({ week }) => week === row.week);
        return input !== undefined && close(row.availableHours, input.hours * mutation.value, 0.01);
      })
      && changed.capacity.some((row) => row.availableHours !== base.capacity.find(({ week }) => week === row.week)?.availableHours);
  }
  if (mutation.kind === "scenario-supplier-lead-time-adjustment") {
    return close(changed.scenario.supplierLeadTimeAdjustmentWeeks, mutation.value, 0.01);
  }
  if (mutation.kind === "scenario-expedite-enabled") {
    return changed.scenario.expediteEnabled === mutation.value
      && changed.purchases.every((purchase) => mutation.value || !purchase.expedited);
  }
  if (mutation.kind === "order-quantity") {
    const before = base.orderProjections.find(({ orderId }) => orderId === mutation.orderId);
    const after = changed.orderProjections.find(({ orderId }) => orderId === mutation.orderId);
    const expectedRequested = mutation.quantity * changed.scenario.demandMultiplier;
    return before !== undefined && after !== undefined
      && close(after.requestedQuantity, expectedRequested, 0.01)
      && close(after.fulfilledQuantity + after.backorderQuantity, expectedRequested, 0.01)
      && after.requestedQuantity !== before.requestedQuantity
      && (after.fulfilledQuantity !== before.fulfilledQuantity || after.backorderQuantity !== before.backorderQuantity || changed.costs.total !== base.costs.total);
  }
  if (mutation.kind === "capacity-hours") {
    const before = base.capacity.find(({ week }) => week === mutation.week);
    const after = changed.capacity.find(({ week }) => week === mutation.week);
    const expectedAvailable = mutation.hours * changed.scenario.capacityMultiplier;
    return before !== undefined && after !== undefined && after.availableHours !== before.availableHours
      && close(after.availableHours, expectedAvailable, 0.01) && after.usedHours <= after.availableHours + 0.01;
  }
  const appliedSourceTerm = changed.sourceInputs.suppliers.some((supplier) => supplier.component === mutation.component
    && close(supplier.normalLeadTimeWeeks, mutation.normalLeadTimeWeeks, 0.01));
  return appliedSourceTerm;
}

function inputsAfterMutation(mutation: PlannerInputMutation): ProductionDeliveryPlannerInputs {
  if (mutation.kind === "scenario-demand-multiplier" || mutation.kind === "scenario-capacity-multiplier"
    || mutation.kind === "scenario-supplier-lead-time-adjustment" || mutation.kind === "scenario-expedite-enabled") {
    return productionDeliveryPlannerInputs;
  }
  if (mutation.kind === "order-quantity") {
    return deepFreeze({
      ...productionDeliveryPlannerInputs,
      orders: productionDeliveryPlannerInputs.orders.map((order) => order.orderId === mutation.orderId ? { ...order, quantity: mutation.quantity } : order),
    });
  }
  if (mutation.kind === "capacity-hours") {
    return deepFreeze({
      ...productionDeliveryPlannerInputs,
      weeklyCapacity: productionDeliveryPlannerInputs.weeklyCapacity.map((capacity) => capacity.week === mutation.week ? { ...capacity, hours: mutation.hours } : capacity),
    });
  }
  return deepFreeze({
    ...productionDeliveryPlannerInputs,
    suppliers: productionDeliveryPlannerInputs.suppliers.map((supplier) => supplier.component === mutation.component
      ? { ...supplier, normalLeadTimeWeeks: mutation.normalLeadTimeWeeks }
      : supplier),
  });
}

function unavailableSemanticChecks(detail: string): readonly EvalCheck[] {
  return ["source-coverage", "workbook-horizon", "scenario-controls", "formula-lineage", "complete-order-coverage", "order-conservation", "component-dependencies", "finished-goods-conservation", "weekly-capacity", "purchase-lead-times", "fulfillment-dates", "infeasible-exceptions", "cost-arithmetic", "cross-sheet-consistency"]
    .map((name) => ({ name: `workspace:${name}`, passed: false, detail }));
}

function csv<Row extends object>(rows: readonly Row[]): string {
  const headers = Object.keys(rows[0] ?? {});
  return `${[headers, ...rows.map((row) => headers.map((header) => (row as Record<string, unknown>)[header]))].map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function digest(value: string): `sha256:${string}` { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
function close(left: number, right: number, tolerance: number): boolean { return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= tolerance; }
function finitePositive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function sum(values: readonly number[]): number { return values.reduce((total, value) => total + value, 0); }
function unique(values: readonly string[]): string[] { return [...new Set(values)]; }
function sameSet(left: readonly string[], right: readonly string[]): boolean { return left.length === right.length && new Set(left).size === left.length && left.every((value) => right.includes(value)); }
function byWeek(left: { readonly week: string }, right: { readonly week: string }): number { return left.week.localeCompare(right.week); }
function money(value: number): string { return Number.isFinite(value) ? `$${value.toFixed(2)}` : "invalid"; }
function addDays(value: string, days: number): string { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function horizonWeekForDate(value: string, horizon: readonly string[]): string | null {
  return horizon.find((week) => value >= week && value < addDays(week, 7)) ?? null;
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function normalizedInputIdentity(inputs: ProductionDeliveryPlannerInputs): string {
  const ordered = <Row>(rows: readonly Row[]): readonly Row[] => [...rows].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
  return canonicalJson({
    schemaVersion: inputs.schemaVersion,
    horizonStart: inputs.horizonStart,
    horizonWeeks: inputs.horizonWeeks,
    orders: ordered(inputs.orders),
    billOfMaterials: ordered(inputs.billOfMaterials),
    inventory: ordered(inputs.inventory),
    suppliers: ordered(inputs.suppliers),
    weeklyCapacity: ordered(inputs.weeklyCapacity),
    shippingOptions: ordered(inputs.shippingOptions),
    products: ordered(inputs.products),
  });
}

function aggregate<Row>(rows: readonly Row[], key: (row: Row) => string, value: (row: Row) => number): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) result.set(key(row), (result.get(key(row)) ?? 0) + value(row));
  return result;
}

async function requireMissing(path: string): Promise<void> {
  try { await access(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new Error(`Refusing to overwrite existing production planner workspace: ${path}`);
}

async function required(
  runCommand: CommandRunner,
  command: string,
  args: readonly string[],
  cwd: string,
  environment: Readonly<Record<string, string>> = {},
): Promise<CommandResult> {
  const result = await runCommand(command, args, { cwd, env: { ...process.env, ...environment } as Readonly<Record<string, string>> });
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`);
  return result;
}

const run: CommandRunner = async (command, args, options) => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  try {
    const result = await promisify(execFile)(command, [...args], { cwd: options.cwd, env: options.env ? { ...process.env, ...options.env } : process.env, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, timeout: 10 * 60_000 });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
    return { exitCode: typeof failure.code === "number" ? failure.code : 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? failure.message };
  }
};

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
