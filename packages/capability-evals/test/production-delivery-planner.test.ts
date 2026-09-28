import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { canonicalJson } from "@relayer/eval-runner";

import {
  PRODUCTION_DELIVERY_PLANNER_CASE_ID,
  PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT,
  PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256,
  dashboardProductionSignalMatches,
  extractProductionDeliveryPlannerModel,
  scenarioMutationProbes,
  createProductionDeliveryPlannerRuntime,
  gradeProductionDeliveryPlannerWorkspace,
  materializeProductionDeliveryPlannerFixture,
  productionDeliveryPlannerCase,
  productionDeliveryPlannerCaseIds,
  productionDeliveryPlannerCases,
  productionDeliveryPlannerRuntimeContract,
  verifyProductionDeliveryPlannerModel,
} from "../src/project-cases/production-delivery-planner.js";
import type { EvalCheck } from "@relayer/eval-runner";
import type { SpreadsheetRuntimeConfig } from "../src/project-cases/spreadsheet-runtime.js";
import { inspectSpreadsheetWorkbook, SPREADSHEET_RUNTIME_SOURCE_SHA256 } from "../src/project-cases/spreadsheet-runtime.js";

const execFileAsync = promisify(execFile);
const builderSource = resolve(import.meta.dirname, "fixtures/production-delivery-planner-workbook.mjs");
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const admissionManifestPath = join(repositoryRoot, "eval-cases/production-delivery-planner/admission-manifest.json");
const nodeExecutable = process.env.RELAYER_SPREADSHEET_NODE;
const nodeModulesPath = process.env.RELAYER_SPREADSHEET_NODE_MODULES;
const runtimeAvailable = process.platform === "darwin" && process.arch === "arm64"
  && Boolean(nodeExecutable && nodeModulesPath);
const runtime: SpreadsheetRuntimeConfig | null = runtimeAvailable ? {
  nodeExecutable: nodeExecutable!,
  nodeModulesPath: nodeModulesPath!,
  environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  nodeVersion: productionDeliveryPlannerRuntimeContract.node,
  artifactToolVersion: productionDeliveryPlannerRuntimeContract.artifactTool,
  nodeExecutableDigest: productionDeliveryPlannerRuntimeContract.nodeExecutableDigest,
  artifactToolEntrypointDigest: productionDeliveryPlannerRuntimeContract.artifactToolEntrypointDigest,
  artifactToolContentDigest: productionDeliveryPlannerRuntimeContract.artifactToolContentDigest,
  timeoutMs: 120_000,
} : null;

type WorkbookVariant =
  | "green-primary"
  | "green-alternate"
  | "mutant-hardcoded"
  | "mutant-capacity"
  | "mutant-components"
  | "mutant-inventory"
  | "mutant-missing-order"
  | "mutant-late-delivery"
  | "mutant-receipt"
  | "mutant-cost"
  | "mutant-stale-dashboard"
  | "mutant-dashboard"
  | "headerless-scenario-aliases";

interface CandidateWorkspace {
  readonly root: string;
  readonly workspaceDirectory: string;
}

const workspaces: CandidateWorkspace[] = [];
const gradeReceipts = new Map<WorkbookVariant, readonly EvalCheck[]>();

describe("production and delivery planner case contract", () => {
  it("binds verifier and shared spreadsheet runtime implementation bytes into case identity", async () => {
    const verifierPath = join(repositoryRoot, "packages/capability-evals/src/project-cases/production-delivery-planner.ts");
    const runtimePath = join(repositoryRoot, "packages/capability-evals/src/project-cases/spreadsheet-runtime.ts");
    const verifier = (await readFile(verifierPath, "utf8")).replace(
      /export const PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256 = "[^"]+";/,
      'export const PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256 = "<normalized>";',
    );
    const runtimeSource = (await readFile(runtimePath, "utf8")).replace(
      /export const SPREADSHEET_RUNTIME_SOURCE_SHA256 = "[^"]+";/,
      'export const SPREADSHEET_RUNTIME_SOURCE_SHA256 = "<normalized>";',
    );

    expect(createHash("sha256").update(verifier).digest("hex")).toBe(PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256);
    expect(createHash("sha256").update(runtimeSource).digest("hex")).toBe(SPREADSHEET_RUNTIME_SOURCE_SHA256);
    expect(PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT).toMatchObject({
      verifierSourceSha256: PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256,
      spreadsheetRuntimeSourceSha256: SPREADSHEET_RUNTIME_SOURCE_SHA256,
    });
    expect(productionDeliveryPlannerCase.snapshot.artifacts.verifier.contentDigest).toBe(
      `sha256:${createHash("sha256").update(canonicalJson(PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT)).digest("hex")}`,
    );
  });

  it("binds the admission manifest to the immutable case, runtime, and portfolio sources", async () => {
    const manifest = JSON.parse(await readFile(admissionManifestPath, "utf8"));
    const fileDigest = async (relativePath: string) => `sha256:${createHash("sha256").update(await readFile(join(repositoryRoot, relativePath))).digest("hex")}`;
    expect(manifest).toMatchObject({
      caseId: PRODUCTION_DELIVERY_PLANNER_CASE_ID,
      caseSnapshotDigest: productionDeliveryPlannerCase.snapshotDigest,
      fixtureContentDigest: productionDeliveryPlannerCase.snapshot.artifacts.workspace.contentDigest,
      environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
      verifierDigest: productionDeliveryPlannerCase.snapshot.artifacts.verifier.contentDigest,
      taskDigest: productionDeliveryPlannerCase.snapshot.artifacts.task.contentDigest,
      greens: ["green-primary", "green-alternate"],
    });
    expect(manifest.sourceDigests).toEqual({
      case: await fileDigest("packages/capability-evals/src/project-cases/production-delivery-planner.ts"),
      runtime: await fileDigest("packages/capability-evals/src/project-cases/spreadsheet-runtime.ts"),
      portfolioBuilder: await fileDigest("packages/capability-evals/test/fixtures/production-delivery-planner-workbook.mjs"),
      admissionRunner: await fileDigest("eval-cases/production-delivery-planner/admission/run-admission.mjs"),
      outcomeClassifier: await fileDigest("eval-cases/spreadsheet-admission-outcome.mjs"),
    });
  });

  it("accepts absent or valid partial dashboard signals and rejects stale values", () => {
    const production = [
      { week: "2026-09-07", sku: "FG-ALPHA", quantity: 4 },
      { week: "2026-09-07", sku: "FG-BETA", quantity: 2 },
      { week: "2026-09-14", sku: "FG-ALPHA", quantity: 0 },
    ];
    const horizon = ["2026-09-07", "2026-09-14"];
    expect(dashboardProductionSignalMatches(null, production, horizon)).toBe(true);
    expect(dashboardProductionSignalMatches([{ week: "2026-09-07", units: 6 }], production, horizon)).toBe(true);
    expect(dashboardProductionSignalMatches([{ week: "2026-09-07", units: 5 }], production, horizon)).toBe(false);
    expect(dashboardProductionSignalMatches([
      { week: "2026-09-07", units: 6 },
      { week: "2026-09-14", units: 1 },
    ], production, horizon)).toBe(false);
    expect(dashboardProductionSignalMatches([{ week: "2026-10-01", units: 0 }], production, horizon)).toBe(false);
  });

  it("declares a changed-input checkpoint for every editable scenario control", () => {
    expect(PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT.predicates.filter((predicate) => predicate.startsWith("changed-scenario-"))).toEqual([
      "changed-scenario-demand-multiplier",
      "changed-scenario-capacity-multiplier",
      "changed-scenario-supplier-lead-time-adjustment",
      "changed-scenario-expedite-enabled",
    ]);
    expect(PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT.scenarioMutationPolicy).toHaveLength(4);
  });

  it("selects scenario mutations relative to sparse and nondefault baseline controls", () => {
    const probes = scenarioMutationProbes({
      scenario: { demandMultiplier: 0.5, capacityMultiplier: 0.8, supplierLeadTimeAdjustmentWeeks: 2, expediteEnabled: false },
      capacity: [{ week: "2026-09-07", availableHours: 80, usedHours: 40 }, { week: "2026-09-14", availableHours: 80, usedHours: 16 }],
      sourceCapacity: [{ week: "2026-09-07", hours: 100 }, { week: "2026-09-14", hours: 100 }],
    });
    expect(probes).toEqual([
      { kind: "scenario-demand-multiplier", value: 0.25 },
      { kind: "scenario-capacity-multiplier", value: 0.2 },
      { kind: "scenario-supplier-lead-time-adjustment", value: 3 },
      { kind: "scenario-expedite-enabled", value: true },
    ]);
    const zeroProduction = scenarioMutationProbes({
      scenario: { demandMultiplier: 0.5, capacityMultiplier: 0.4, supplierLeadTimeAdjustmentWeeks: 0, expediteEnabled: true },
      capacity: [{ week: "2026-09-07", availableHours: 40, usedHours: 0 }],
      sourceCapacity: [{ week: "2026-09-07", hours: 100 }],
    });
    expect(zeroProduction[1]).toEqual({ kind: "scenario-capacity-multiplier", value: 0.2 });
    expect(zeroProduction[3]).toEqual({ kind: "scenario-expedite-enabled", value: false });
  });

  it("publishes one candidate case with a sealed verifier and no private catalog paths", () => {
    expect(PRODUCTION_DELIVERY_PLANNER_CASE_ID).toBe("capability.spreadsheet.production-delivery-planner");
    expect([...productionDeliveryPlannerCaseIds]).toEqual([PRODUCTION_DELIVERY_PLANNER_CASE_ID]);
    expect(productionDeliveryPlannerCases).toEqual([productionDeliveryPlannerCase]);
    expect(productionDeliveryPlannerCase.snapshot).toMatchObject({
      id: PRODUCTION_DELIVERY_PLANNER_CASE_ID,
      category: "work",
      taskType: "spreadsheet-model",
      authoringStatus: "candidate",
      artifacts: {
        task: { kind: "visible-task" },
        workspace: { kind: "frozen-workspace" },
        reference: { kind: "sealed-reference", format: "semantic-contract" },
        verifier: { kind: "sealed-verifier" },
      },
    });
    expect(productionDeliveryPlannerCase.definition.threads).toHaveLength(1);
    expect(productionDeliveryPlannerCase.definition.threads[0]).toMatchObject({
      mutationPolicy: "writable",
      workspaceGrade: "autonomous-implementation",
    });
    const task = productionDeliveryPlannerCase.snapshot.artifacts.task.text;
    for (const promise of [
      "twelve-week", "order", "component", "inventory", "supplier", "capacity", "shipping",
      "scenario", "purchase", "expedite", "exception", "cost", "dashboard", ".xlsx",
    ]) expect(task.toLowerCase()).toContain(promise);
    expect(JSON.stringify(productionDeliveryPlannerCase.catalogSnapshot)).not.toContain("sealedPath");
    expect(productionDeliveryPlannerCase.snapshotDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe.skipIf(!runtimeAvailable)("production and delivery planner verifier admission portfolio", () => {
  const candidates = new Map<WorkbookVariant, CandidateWorkspace>();

  beforeAll(async () => {
    if (!runtime) return;
    for (const variant of [
      "green-primary",
      "green-alternate",
      "mutant-hardcoded",
      "mutant-capacity",
      "mutant-components",
      "mutant-inventory",
      "mutant-missing-order",
      "mutant-late-delivery",
      "mutant-receipt",
      "mutant-cost",
      "mutant-stale-dashboard",
      "mutant-dashboard",
    ] as const) candidates.set(variant, await createCandidate(variant));
  }, 180_000);

  afterAll(async () => {
    await Promise.all(workspaces.splice(0).map(({ root }) => rm(root, { recursive: true, force: true })));
  });

  it("keeps the untouched deterministic fixture red for the intended missing-delivery reasons", async () => {
    if (!runtime) return;
    const root = await mkdtemp(join(tmpdir(), "planner-red-"));
    const workspaceDirectory = join(root, "workspace");
    workspaces.push({ root, workspaceDirectory });
    await materializeProductionDeliveryPlannerFixture({ workspaceDirectory, platform: "darwin" });

    const checks = await gradeProductionDeliveryPlannerWorkspace({ workspaceDirectory, runtime });

    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(checkNamed(checks, "workspace:workbook-parse").passed).toBe(false);
    expect(checkNamed(checks, "workspace:workbook-rendering").passed).toBe(false);
    expect(checks.some(({ passed }) => passed)).toBe(true);
  });

  it("imports receipt formula outputs as numeric quantities and extracts sparse exception rows", async () => {
    if (!runtime) return;
    const candidate = candidates.get("green-primary");
    if (!candidate) throw new Error("Green primary candidate was not created");
    const workbookPath = join(candidate.workspaceDirectory, "production-delivery-plan.xlsx");
    const receipt = await inspectSpreadsheetWorkbook({ workbookPath, runtime });
    const model = extractProductionDeliveryPlannerModel(receipt);
    const receiptRow = model.components.find(({ week, component }) => week === "2026-10-19" && component === "CMP-A");
    expect(receiptRow?.receipts).toBe(53);
    expect(typeof receiptRow?.receipts).toBe("number");
    expect(model.exceptions).toHaveLength(1);
    expect(model.exceptions[0]).toMatchObject({ type: "infeasible", orderId: "ORD-1006" });
    expect(model.dashboardViews).toHaveLength(1);
    expect(model.dashboardViews[0]?.capacity.usedHours).toBe(model.capacity.reduce((total, row) => total + row.usedHours, 0));
    expect(model.dashboardViews[0]?.capacity.availableHours).toBe(model.capacity.reduce((total, row) => total + row.availableHours, 0));

    const changedCapacityReceipt = await inspectSpreadsheetWorkbook({
      workbookPath,
      runtime,
      mutations: [{
        kind: "label-value",
        labels: ["capacity used hours"],
        value: (model.dashboardViews[0]?.capacity.usedHours ?? 0) + 1,
      }],
    });
    const changedCapacityChecks = verifyProductionDeliveryPlannerModel(extractProductionDeliveryPlannerModel(changedCapacityReceipt));
    expect(checkNamed(changedCapacityChecks, "workspace:cost-arithmetic").passed, JSON.stringify(checkNamed(changedCapacityChecks, "workspace:cost-arithmetic"))).toBe(true);
    expect(checkNamed(changedCapacityChecks, "workspace:cross-sheet-consistency").passed).toBe(false);

    const alternateCandidate = candidates.get("green-alternate");
    if (!alternateCandidate || !runtime) throw new Error("Green alternate candidate was not created");
    const alternateReceipt = await inspectSpreadsheetWorkbook({
      workbookPath: join(alternateCandidate.workspaceDirectory, "production-delivery-plan.xlsx"),
      runtime,
    });
    const decorative = extractProductionDeliveryPlannerModel(alternateReceipt).formulas.filter(({ formula }) => formula.includes("FY 2026") || formula.trim() === "=0");
    expect(decorative).toHaveLength(2);
    expect(decorative.every(({ precedentRoles }) => precedentRoles.length === 0)).toBe(true);
    const alternateModel = extractProductionDeliveryPlannerModel(alternateReceipt);
    expect(alternateModel.dashboardViews).toHaveLength(1);
    expect(alternateModel.dashboardViews[0]?.sheetName).toBe("Executive View");
    expect(alternateModel.dashboardViews[0]?.capacity).toMatchObject({ usedHours: null, availableHours: null });
    expect(alternateModel.dashboardViews[0]?.capacity.utilization).toBeCloseTo(
      alternateModel.capacity.reduce((total, row) => total + row.usedHours, 0)
        / alternateModel.capacity.reduce((total, row) => total + row.availableHours, 0),
      3,
    );
    const alternateDashboard = alternateReceipt.sheets.find(({ name }) => name === "Executive View");
    if (!alternateDashboard) throw new Error("Relocated dashboard sheet was not imported");
    const percentSheet = { ...alternateDashboard, values: alternateDashboard.values.map((row) => [...row]) };
    const utilizationCell = percentSheet.values.flatMap((row, rowIndex) => row.map((value, columnIndex) => ({ value, rowIndex, columnIndex })))
      .find(({ value }) => String(value ?? "").trim().toLowerCase() === "capacity utilization");
    if (!utilizationCell) throw new Error("Alternate dashboard utilization label was not located");
    percentSheet.values[utilizationCell.rowIndex]![utilizationCell.columnIndex] = "Capacity Utilization Percent";
    percentSheet.values[utilizationCell.rowIndex]![utilizationCell.columnIndex + 1] = 250;
    const overfullPercentModel = extractProductionDeliveryPlannerModel({
      ...alternateReceipt,
      sheets: alternateReceipt.sheets.map((sheet) => sheet.name === percentSheet.name ? percentSheet : sheet),
    });
    expect(overfullPercentModel.dashboardViews[0]?.capacity.utilization).toBe(2.5);
    expect(checkNamed(verifyProductionDeliveryPlannerModel(overfullPercentModel), "workspace:cross-sheet-consistency").passed).toBe(false);

    percentSheet.values[utilizationCell.rowIndex]![utilizationCell.columnIndex] = "Capacity Utilization Rate";
    percentSheet.values[utilizationCell.rowIndex]![utilizationCell.columnIndex + 1] = "250%";
    const percentStringModel = extractProductionDeliveryPlannerModel({
      ...alternateReceipt,
      sheets: alternateReceipt.sheets.map((sheet) => sheet.name === percentSheet.name ? percentSheet : sheet),
    });
    expect(percentStringModel.dashboardViews[0]?.capacity.utilization).toBe(2.5);
    expect(checkNamed(verifyProductionDeliveryPlannerModel(percentStringModel), "workspace:cross-sheet-consistency").passed).toBe(false);
    const namedFormula = alternateModel.formulas.find(({ formula }) => formula.includes("PlannerOrder1001Quantity"));
    expect(namedFormula).toMatchObject({ derivedOutputCell: true, precedentRoles: [] });
    const blankExceptionFormula = alternateModel.formulas.find(({ formula }) => formula.includes('IF(1=1,"","")'));
    expect(blankExceptionFormula).toMatchObject({ derivedOutputCell: true });
    expect(decorative.every(({ derivedOutputCell }) => !derivedOutputCell)).toBe(true);

    const identicalDashboard = { ...alternateDashboard, name: "Operations Summary Copy" };
    const duplicateViewModel = extractProductionDeliveryPlannerModel({
      ...alternateReceipt,
      sheets: [...alternateReceipt.sheets, identicalDashboard],
    });
    const duplicateChecks = verifyProductionDeliveryPlannerModel(duplicateViewModel);
    expect(checkNamed(duplicateChecks, "workspace:cross-sheet-consistency").passed, JSON.stringify(checkNamed(duplicateChecks, "workspace:cross-sheet-consistency"))).toBe(true);

    const conflictingValues = alternateDashboard.values.map((row) => [...row]);
    const costLabelRow = conflictingValues.findIndex((row) => row.some((value) => String(value ?? "").trim().toLowerCase() === "management total cost"));
    const costLabelColumn = conflictingValues[costLabelRow]?.findIndex((value) => String(value ?? "").trim().toLowerCase() === "management total cost") ?? -1;
    if (costLabelRow < 0 || costLabelColumn < 0) throw new Error("Dashboard total cost signal was not located");
    conflictingValues[costLabelRow + 1]![costLabelColumn] = Number(conflictingValues[costLabelRow + 1]![costLabelColumn]) + 100;
    const conflictingDashboard = { ...alternateDashboard, name: "Conflicting Operations Summary", values: conflictingValues };
    const conflictingViewModel = extractProductionDeliveryPlannerModel({
      ...alternateReceipt,
      sheets: [...alternateReceipt.sheets, conflictingDashboard],
    });
    expect(checkNamed(verifyProductionDeliveryPlannerModel(conflictingViewModel), "workspace:cross-sheet-consistency").passed).toBe(false);
  }, 120_000);

  it("admits two materially different formula-driven workbooks without exact sheet coordinates or row order", async () => {
    if (!runtime) return;
    const primary = await grade("green-primary", runtime, candidates);
    const alternate = await grade("green-alternate", runtime, candidates);

    expect(primary.filter(({ passed }) => !passed), JSON.stringify(primary.filter(({ passed }) => !passed), null, 2)).toEqual([]);
    expect(alternate.filter(({ passed }) => !passed), JSON.stringify(alternate.filter(({ passed }) => !passed), null, 2)).toEqual([]);
    expect(primary.filter(({ name }) => name.startsWith("workspace:changed-input-")).every(({ passed }) => passed)).toBe(true);
    expect(alternate.filter(({ name }) => name.startsWith("workspace:changed-input-")).every(({ passed }) => passed)).toBe(true);
    const scenarioChecks = [
      "workspace:changed-scenario-demand-multiplier",
      "workspace:changed-scenario-capacity-multiplier",
      "workspace:changed-scenario-supplier-lead-time-adjustment",
      "workspace:changed-scenario-expedite-enabled",
    ];
    for (const checks of [primary, alternate]) {
      expect(scenarioChecks.map((name) => checkNamed(checks, name).passed)).toEqual([true, true, true, true]);
    }
    expect(checkNamed(primary, "workspace:workbook-rendering").detail).toMatch(/png|render|sheet/i);
    expect(checkNamed(alternate, "workspace:workbook-rendering").detail).toMatch(/png|render|sheet/i);

  }, 180_000);

  it.each([
    ["mutant-hardcoded", "workspace:changed-input-order-quantity"],
    ["mutant-capacity", "workspace:weekly-capacity"],
    ["mutant-components", "workspace:component-dependencies"],
    ["mutant-inventory", "workspace:component-dependencies"],
    ["mutant-missing-order", "workspace:complete-order-coverage"],
    ["mutant-late-delivery", "workspace:fulfillment-dates"],
    ["mutant-receipt", "workspace:purchase-lead-times"],
    ["mutant-cost", "workspace:cost-arithmetic"],
    ["mutant-stale-dashboard", "workspace:cross-sheet-consistency"],
    ["mutant-dashboard", "workspace:workbook-rendering"],
  ] as const)("rejects %s through the independent %s predicate", async (variant, predicate) => {
    if (!runtime) return;
    const checks = await grade(variant, runtime, candidates);
    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(checkNamed(checks, predicate).passed).toBe(false);
    expect(checks.some(({ passed }) => passed)).toBe(true);
    if (variant === "mutant-hardcoded") {
      const candidate = candidates.get(variant);
      if (!candidate || !runtime) throw new Error("Hardcoded candidate was not created");
      const receipt = await inspectSpreadsheetWorkbook({
        workbookPath: join(candidate.workspaceDirectory, "production-delivery-plan.xlsx"),
        runtime,
      });
      const model = extractProductionDeliveryPlannerModel(receipt);
      expect(model.formulas).toHaveLength(2);
      expect(model.formulas.every(({ derivedOutputCell }) => !derivedOutputCell)).toBe(true);
      const expectedFailures = [
        "workspace:formula-lineage",
        "workspace:changed-input-order-quantity",
        "workspace:changed-input-order-quantity-boundary-2",
        "workspace:changed-input-capacity-hours",
        "workspace:changed-input-capacity-hours-boundary-2",
        "workspace:changed-input-supplier-lead-time",
        "workspace:changed-input-supplier-lead-time-boundary-2",
        "workspace:changed-scenario-demand-multiplier",
        "workspace:changed-scenario-capacity-multiplier",
        "workspace:changed-scenario-supplier-lead-time-adjustment",
        "workspace:changed-scenario-expedite-enabled",
      ];
      expect(checks.filter(({ passed }) => !passed).map(({ name }) => name).sort()).toEqual([...expectedFailures].sort());
      expect(checks.filter(({ name }) => [
        "workspace:source-coverage", "workspace:workbook-horizon", "workspace:scenario-controls",
        "workspace:complete-order-coverage", "workspace:order-conservation", "workspace:component-dependencies",
        "workspace:finished-goods-conservation", "workspace:weekly-capacity", "workspace:purchase-lead-times",
        "workspace:fulfillment-dates", "workspace:infeasible-exceptions", "workspace:cost-arithmetic",
        "workspace:cross-sheet-consistency",
      ].includes(name)).every(({ passed }) => passed)).toBe(true);
    }
  }, 180_000);

  it("emits the component mutant at the final authoritative consumption cell", async () => {
    if (!runtime) return;
    const baselineWorkspace = candidates.get("green-primary");
    const mutantWorkspace = candidates.get("mutant-components");
    if (!baselineWorkspace || !mutantWorkspace) throw new Error("Component candidates were not created");
    const inspect = async (workspace: CandidateWorkspace) => {
      const receipt = await inspectSpreadsheetWorkbook({
        workbookPath: join(workspace.workspaceDirectory, "production-delivery-plan.xlsx"),
        runtime,
      });
      return extractProductionDeliveryPlannerModel(receipt).components.find(({ week, component }) => (
        week === "2026-09-07" && component === "CMP-A"
      ))?.consumed;
    };
    expect(await inspect(baselineWorkspace)).toBe(16);
    expect(await inspect(mutantWorkspace)).toBe(15);
    expect(checkNamed(await grade("mutant-components", runtime, candidates), "workspace:component-dependencies").passed).toBe(false);
  }, 60_000);

  it("records independent predicates even when cost arithmetic fails", async () => {
    if (!runtime) return;
    const checks = await grade("mutant-cost", runtime, candidates);
    expect(checkNamed(checks, "workspace:cost-arithmetic").passed).toBe(false);
    expect(checkNamed(checks, "workspace:cross-sheet-consistency").passed).toBe(true);
    expect(checkNamed(checks, "workspace:complete-order-coverage").passed).toBe(true);
    expect(checkNamed(checks, "workspace:weekly-capacity").passed).toBe(true);
    expect(checkNamed(checks, "workspace:component-dependencies").passed).toBe(true);
  }, 180_000);
});

async function grade(
  variant: WorkbookVariant,
  configuredRuntime: SpreadsheetRuntimeConfig,
  candidates: ReadonlyMap<WorkbookVariant, CandidateWorkspace>,
): Promise<readonly EvalCheck[]> {
  const candidate = candidates.get(variant);
  if (!candidate) throw new Error(`Candidate was not created: ${variant}`);
  const prior = gradeReceipts.get(variant);
  if (prior) return prior;
  const checks = await gradeProductionDeliveryPlannerWorkspace({
    workspaceDirectory: candidate.workspaceDirectory,
    runtime: configuredRuntime,
  });
  gradeReceipts.set(variant, checks);
  return checks;
}

function checkNamed(checks: readonly EvalCheck[], expectedName: string): EvalCheck {
  const matching = checks.filter(({ name }) => name === expectedName);
  expect(matching, `Expected exactly one ${expectedName}; received ${checks.map(({ name }) => name).join(", ")}`).toHaveLength(1);
  return matching[0]!;
}

async function createCandidate(variant: WorkbookVariant): Promise<CandidateWorkspace> {
  if (!runtime) throw new Error("Spreadsheet runtime is unavailable.");
  const root = await mkdtemp(join(tmpdir(), `planner-${variant}-`));
  const workspaceDirectory = join(root, "workspace");
  const runtimeDirectory = join(root, "artifact-runtime");
  const builderPath = join(runtimeDirectory, "builder.mjs");
  const workbookPath = join(workspaceDirectory, "production-delivery-plan.xlsx");
  workspaces.push({ root, workspaceDirectory });
  await materializeProductionDeliveryPlannerFixture({ workspaceDirectory, platform: "darwin" });
  await mkdir(runtimeDirectory, { recursive: true });
  await cp(builderSource, builderPath);
  await symlink(runtime.nodeModulesPath, join(runtimeDirectory, "node_modules"), "dir");
  await execFileAsync(runtime.nodeExecutable, [builderPath, workbookPath, variant], {
    cwd: runtimeDirectory,
    env: {
      TMPDIR: runtimeDirectory,
      TZ: "UTC",
      LANG: "C",
      LC_ALL: "C",
      PATH: dirname(runtime.nodeExecutable),
    },
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  await rm(`${workbookPath}.inspect.ndjson`, { force: true });
  await git(workspaceDirectory, ["add", "--", "production-delivery-plan.xlsx"]);
  await git(workspaceDirectory, ["commit", "--quiet", "-m", `Deliver planner workbook (${variant})`], {
    GIT_AUTHOR_NAME: "Relayer Eval Candidate",
    GIT_AUTHOR_EMAIL: "eval-candidate@relayer.local",
    GIT_AUTHOR_DATE: "2026-08-28T12:00:00Z",
    GIT_COMMITTER_NAME: "Relayer Eval Candidate",
    GIT_COMMITTER_EMAIL: "eval-candidate@relayer.local",
    GIT_COMMITTER_DATE: "2026-08-28T12:00:00Z",
  });
  return { root, workspaceDirectory };
}

async function git(
  cwd: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = {},
): Promise<void> {
  await execFileAsync("git", [...args], {
    cwd,
    env: { ...process.env, ...environment },
    encoding: "utf8",
    timeout: 30_000,
  });
}


describe.skipIf(!runtimeAvailable)("spreadsheet label-value mutation bridge", () => {
  it("mutates aliased headerless controls and fails closed on ambiguous or missing targets", async () => {
    if (!runtime) return;
    const candidate = await createCandidate("headerless-scenario-aliases");
    try {
      const workbookPath = join(candidate.workspaceDirectory, "production-delivery-plan.xlsx");
      const initial = await inspectSpreadsheetWorkbook({ workbookPath, runtime });
      expect(extractProductionDeliveryPlannerModel(initial).scenario.demandMultiplier).toBe(0.5);
      const success = await inspectSpreadsheetWorkbook({
        workbookPath,
        runtime,
        mutations: [{ kind: "label-value", labels: ["capacity multiplier", "capacity factor"], value: 0.25 }],
      });
      expect(success.mutations).toHaveLength(1);
      expect(success.mutations[0]).toMatchObject({ sheetName: "Scenario", previousValue: 1, value: 0.25 });
      const scenarioSheet = success.sheets.find(({ name }) => name === "Scenario");
      expect(scenarioSheet?.values[1]?.[1]).toBe(0.25);

      await expect(inspectSpreadsheetWorkbook({
        workbookPath,
        runtime,
        mutations: [{ kind: "label-value", labels: ["demand multiplier", "demand factor"], value: 0.5 }],
      })).rejects.toMatchObject({ detail: expect.stringMatching(/expected one match and found 2/) });
      await expect(inspectSpreadsheetWorkbook({
        workbookPath,
        runtime,
        mutations: [{ kind: "label-value", labels: ["unused control"], value: 0.5 }],
      })).rejects.toMatchObject({ detail: expect.stringMatching(/expected one match and found 0/) });
      await expect(inspectSpreadsheetWorkbook({
        workbookPath,
        runtime,
        mutations: [{ kind: "label-value", labels: ["missing control"], value: 0.5 }],
      })).rejects.toMatchObject({ detail: expect.stringMatching(/expected one match and found 0/) });
    } finally {
      const index = workspaces.findIndex(({ root }) => root === candidate.root);
      if (index >= 0) workspaces.splice(index, 1);
      await rm(candidate.root, { recursive: true, force: true });
    }
  }, 60_000);
});
