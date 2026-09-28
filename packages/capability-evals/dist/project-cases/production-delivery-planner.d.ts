import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
import { type SpreadsheetRuntimeConfig, type SpreadsheetWorkbookReceipt } from "./spreadsheet-runtime.js";
export declare const PRODUCTION_DELIVERY_PLANNER_CASE_ID: "capability.spreadsheet.production-delivery-planner";
export declare const PRODUCTION_DELIVERY_PLANNER_VERIFIER_SOURCE_SHA256 = "d995f5d5f35e7366099a08fe5838dbbd0d62605088155548002cdd582be9fd1f";
export declare const PRODUCTION_DELIVERY_PLANNER_OUTPUT: "production-delivery-plan.xlsx";
export declare const PRODUCTION_DELIVERY_PLANNER_SOURCE: "relayer-eval://production-delivery-planner-v1";
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
export declare const productionDeliveryPlannerInputs: ProductionDeliveryPlannerInputs;
export declare const productionDeliveryPlannerVisibleTask: string;
export declare const PRODUCTION_DELIVERY_PLANNER_FIXTURE_CONTENT_DIGEST: `sha256:${string}`;
export declare const PRODUCTION_DELIVERY_PLANNER_SOURCE_REVISION: `fixture:sha256:${string}`;
export declare const productionDeliveryPlannerRuntimeContract: {
    readonly id: "relayer-spreadsheet-runtime-v1";
    readonly bundle: "26.826.12353";
    readonly node: "24.19.0";
    readonly artifactTool: "2.8.59";
    readonly nodeExecutableDigest: "sha256:27db838bb204ef7c21df2931f5656e4c8fb32e6e947f363a402b49714d32b5b1";
    readonly artifactToolEntrypointDigest: "sha256:d23c29992898aaf6efc0f78611ee34ba213579fa25e05ad4dc5dbcb356c11a89";
    readonly artifactToolContentDigest: "sha256:eb3c0b54042c490c79837b4cd093028f34f2199e22236977ddbba6ec0482924c";
    readonly workbookFormat: "xlsx";
    readonly capabilities: readonly ["author", "import", "calculate", "inspect", "mutate", "render"];
};
export declare const PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST: `sha256:${string}`;
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
export declare const PRODUCTION_DELIVERY_PLANNER_VERIFIER_CONTRACT: {
    schemaVersion: number;
    verifierSourceSha256: string;
    spreadsheetRuntimeSourceSha256: string;
    extraction: string;
    dashboardPolicy: string;
    changedInputConsistency: string;
    mandatoryGates: {
        id: string;
        label: string;
        description: string;
    }[];
    predicates: string[];
    formulaLineagePolicy: string;
    scenarioMutationPolicy: {
        kind: string;
        selection: string;
    }[];
    mutations: ({
        kind: string;
        orderId: string;
        quantity: number;
        week?: undefined;
        hours?: undefined;
        component?: undefined;
        normalLeadTimeWeeks?: undefined;
    } | {
        kind: string;
        week: string;
        hours: number;
        orderId?: undefined;
        quantity?: undefined;
        component?: undefined;
        normalLeadTimeWeeks?: undefined;
    } | {
        kind: string;
        component: string;
        normalLeadTimeWeeks: number;
        orderId?: undefined;
        quantity?: undefined;
        week?: undefined;
        hours?: undefined;
    })[];
    layoutMatching: boolean;
    referenceWorkbookMatching: boolean;
    runtime: {
        readonly id: "relayer-spreadsheet-runtime-v1";
        readonly bundle: "26.826.12353";
        readonly node: "24.19.0";
        readonly artifactTool: "2.8.59";
        readonly nodeExecutableDigest: "sha256:27db838bb204ef7c21df2931f5656e4c8fb32e6e947f363a402b49714d32b5b1";
        readonly artifactToolEntrypointDigest: "sha256:d23c29992898aaf6efc0f78611ee34ba213579fa25e05ad4dc5dbcb356c11a89";
        readonly artifactToolContentDigest: "sha256:eb3c0b54042c490c79837b4cd093028f34f2199e22236977ddbba6ec0482924c";
        readonly workbookFormat: "xlsx";
        readonly capabilities: readonly ["author", "import", "calculate", "inspect", "mutate", "render"];
    };
};
export declare const productionDeliveryPlannerCase: import("@relayer/eval-runner").BoundAutonomousCase<ProductionDeliveryPlannerCaseDefinition>;
export declare const productionDeliveryPlannerCases: readonly import("@relayer/eval-runner").BoundAutonomousCase<ProductionDeliveryPlannerCaseDefinition>[];
export declare const productionDeliveryPlannerCaseIds: Set<"capability.spreadsheet.production-delivery-planner">;
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
export declare function materializeProductionDeliveryPlannerFixture(options: {
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly runCommand?: CommandRunner;
}): Promise<ProductionDeliveryPlannerFixtureReceipt>;
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
export interface PlannerProductionRow {
    readonly week: string;
    readonly sku: string;
    readonly quantity: number;
}
export interface PlannerFinishedGoodsRow {
    readonly week: string;
    readonly sku: string;
    readonly opening: number;
    readonly produced: number;
    readonly shipped: number;
    readonly closing: number;
}
export interface PlannerComponentRow {
    readonly week: string;
    readonly component: string;
    readonly opening: number;
    readonly receipts: number;
    readonly consumed: number;
    readonly closing: number;
}
export interface PlannerPurchaseRow {
    readonly component: string;
    readonly supplier: string;
    readonly quantity: number;
    readonly orderDate: string;
    readonly receiptDate: string;
    readonly expedited: boolean;
    readonly unitCost: number;
    readonly expeditePremiumPerUnit: number;
}
export interface PlannerCapacityRow {
    readonly week: string;
    readonly availableHours: number;
    readonly usedHours: number;
}
export interface PlannerExceptionRow {
    readonly type: "late" | "short" | "infeasible" | "capacity" | "component";
    readonly orderId: string | null;
    readonly detail: string;
}
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
    readonly costs: {
        readonly production: number;
        readonly purchasing: number;
        readonly expedite: number;
        readonly shipping: number;
        readonly holding: number;
        readonly total: number;
    };
    readonly dashboardViews: readonly PlannerDashboardView[];
    readonly sheetTotals: {
        readonly fulfilledUnits: number;
        readonly purchaseUnits: number;
        readonly productionUnits: number;
        readonly exceptionCount: number;
        readonly totalCost: number;
    };
    readonly formulas: readonly PlannerFormulaEvidence[];
    readonly formulaErrors: readonly string[];
}
interface PlannerDashboardView {
    readonly sheetName: string;
    readonly summary: {
        readonly totalOrders: number;
        readonly unitsRequested: number;
        readonly unitsFulfilled: number;
        readonly lateOrders: number;
        readonly exceptionCount: number;
        readonly totalCost: number;
    };
    readonly capacity: {
        readonly usedHours: number | null;
        readonly availableHours: number | null;
        readonly utilization: number | null;
    };
    readonly productionSignal: readonly {
        readonly week: string;
        readonly units: number;
    }[] | null;
}
export type PlannerInputMutation = {
    readonly kind: "order-quantity";
    readonly orderId: string;
    readonly quantity: number;
} | {
    readonly kind: "capacity-hours";
    readonly week: string;
    readonly hours: number;
} | {
    readonly kind: "supplier-lead-time";
    readonly component: string;
    readonly normalLeadTimeWeeks: number;
} | {
    readonly kind: "scenario-demand-multiplier";
    readonly value: number;
} | {
    readonly kind: "scenario-capacity-multiplier";
    readonly value: number;
} | {
    readonly kind: "scenario-supplier-lead-time-adjustment";
    readonly value: number;
} | {
    readonly kind: "scenario-expedite-enabled";
    readonly value: boolean;
};
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
export declare function createProductionDeliveryPlannerRuntime(config: SpreadsheetRuntimeConfig): ProductionDeliveryPlannerRuntime;
export declare function extractProductionDeliveryPlannerModel(receipt: SpreadsheetWorkbookReceipt): ProductionDeliveryPlannerWorkbookModel;
export declare function verifyProductionDeliveryPlannerModel(model: ProductionDeliveryPlannerWorkbookModel, inputs?: ProductionDeliveryPlannerInputs): readonly EvalCheck[];
export interface PlannerScenarioProbeInput {
    readonly scenario: Pick<PlannerScenarioModel, "demandMultiplier" | "capacityMultiplier" | "supplierLeadTimeAdjustmentWeeks" | "expediteEnabled">;
    readonly capacity: readonly PlannerCapacityRow[];
    readonly sourceCapacity: readonly {
        readonly week: string;
        readonly hours: number;
    }[];
}
export declare function scenarioMutationProbes(input: PlannerScenarioProbeInput): readonly PlannerInputMutation[];
export declare function gradeProductionDeliveryPlannerWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly runtime: ProductionDeliveryPlannerRuntime | SpreadsheetRuntimeConfig;
    readonly baseRevision?: string;
    readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]>;
export declare function dashboardProductionSignalMatches(signal: readonly {
    readonly week: string;
    readonly units: number;
}[] | null, production: readonly PlannerProductionRow[], horizonWeeks: readonly string[]): boolean;
export {};
