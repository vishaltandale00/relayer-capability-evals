import type { EvalCheck } from "@relayer/eval-runner";
import type { ProjectEvalThreadDefinition } from "@relayer/eval-runner";
import { type SpreadsheetRuntimePaths, type WorkbookInspector } from "./spreadsheet-artifact-inspector.js";
export declare const SAAS_OPERATING_MODEL_CASE_ID = "capability.spreadsheet.saas-operating-model";
export declare const SAAS_OPERATING_MODEL_FILENAME = "deliverables/saas-operating-model.xlsx";
export declare const SAAS_SOURCE_FILES: Readonly<{
    "inputs/subscriptions.csv": "subscription_id,customer_id,plan,start_date,end_date,status,monthly_amount,currency,updated_at\n sub-001 ,C-001, Growth ,2024-11-01,,ACTIVE,\"$1,200.00\",usd,2025-01-02T09:00:00Z\nsub-002,C-002,starter,2025/01/15,,active,$500,USD,2025-01-16T09:00:00Z\nsub-003,C-003,GROWTH,2025-02-01,2025-08-31,cancelled,\"1,500\",USD,2025-09-01T09:00:00Z\nsub-004,C-004,Enterprise,2024-06-01,,active,\"$3,000\",USD,2025-01-02T09:00:00Z\nsub-005,C-005,Starter,2025-03-10,,active,$650,usd,2025-03-11T09:00:00Z\nsub-006,C-006,Growth,2025-04-01,,active,\"$1,800\",USD,2025-04-02T09:00:00Z\nsub-007,C-007,Starter,2025-01-01,2025-05-31,cancelled,$400,USD,2025-06-01T09:00:00Z\nsub-008,C-008,Enterprise,2025-06-01,,active,\"$4,200\",USD,2025-06-02T09:00:00Z\nsub-009,C-009,Growth,2025-07-01,,active,\"$1,400\",USD,2025-07-02T09:00:00Z\nsub-010,C-010,Starter,2025-09-01,,active,$700,USD,2025-09-02T09:00:00Z\nsub-006,C-006,Growth,2025-04-01,,active,\"$2,000\",USD,2025-10-01T09:00:00Z\nsub-011,C-011,Growth,2025-10-01,,active,\"$1,600\",USD,2025-10-02T09:00:00Z\nsub-012,C-012,Enterprise,2025-11-01,,active,\"$5,000\",USD,2025-11-02T09:00:00Z\nsub-013,C-013,Growth,2025-01-01,2025-06-30,active,\"$1,000\",USD,2025-01-02T09:00:00Z\nsub-014,C-013,Growth,2025-07-01,,active,\"$1,250\",USD,2025-07-02T09:00:00Z\nsub-015,C-014,Growth,2025-02-01,2025-09-30,active,$900,USD,2025-02-02T09:00:00Z\nsub-016,C-014,Growth,2025-10-01,,active,$700,USD,2025-10-02T09:00:00Z\n";
    "inputs/invoices.csv": "invoice_id,customer_id,service_month,subtotal,tax,credit,total,status,updated_at\nINV-001,C-001,2025-01,\"1,200\",0,0,\"1,200\",paid,2025-01-31T12:00:00Z\nINV-002,C-002,2025-01,500,0,0,500,PAID,2025-01-31T12:00:00Z\nINV-003,C-004,2025-01,\"3,000\",0,0,\"3,000\",paid,2025-01-31T12:00:00Z\nINV-004,C-003,2025-02,\"1,500\",0,0,\"1,500\",paid,2025-02-28T12:00:00Z\nINV-005,C-005,2025-03,650,0,0,650,paid,2025-03-31T12:00:00Z\nINV-006,C-006,2025-04,\"1,800\",0,0,\"1,800\",paid,2025-04-30T12:00:00Z\nINV-007,C-007,2025-05,400,0,0,400,paid,2025-05-31T12:00:00Z\nINV-008,C-008,2025-06,\"4,200\",0,0,\"4,200\",open,2025-06-30T12:00:00Z\nINV-009,C-009,2025-07,\"1,400\",0,0,\"1,400\",paid,2025-07-31T12:00:00Z\nINV-010,C-003,2025-08,\"1,500\",0,-300,\"1,200\",paid,2025-08-31T12:00:00Z\nINV-011,C-010,2025-09,700,0,0,700,paid,2025-09-30T12:00:00Z\nINV-012,C-006,2025-10,\"2,000\",0,0,\"2,000\",paid,2025-10-31T12:00:00Z\nINV-013,C-011,2025-10,\"1,600\",0,0,\"1,600\",paid,2025-10-31T12:00:00Z\nINV-014,C-012,2025-11,\"5,000\",0,0,\"5,000\",open,2025-11-30T12:00:00Z\nINV-015,C-004,2025-12,\"3,000\",0,0,\"3,000\",paid,2025-12-31T12:00:00Z\nINV-008,C-008,2025-06,\"4,200\",0,-200,\"4,000\",paid,2025-07-03T12:00:00Z\n";
    "inputs/payments.csv": "payment_id,invoice_id,paid_date,amount,status,method\nPAY-001,INV-001,2025-01-20,\"1,200\",settled,ach\nPAY-002,INV-002,2025-02-02,500,settled,card\nPAY-003,INV-003,2025-01-25,\"3,000\",settled,wire\nPAY-004,INV-004,2025-03-05,\"1,500\",settled,ach\nPAY-005,INV-005,2025-03-25,650,settled,card\nPAY-006,INV-006,2025-05-02,\"1,800\",settled,ach\nPAY-007,INV-007,2025-05-28,400,settled,card\nPAY-008,INV-008,2025-07-03,\"4,000\",settled,wire\nPAY-009,INV-009,2025-07-20,\"1,400\",settled,ach\nPAY-010,INV-010,2025-08-25,\"1,200\",settled,ach\nPAY-011,INV-011,2025-10-02,700,settled,card\nPAY-012,INV-012,2025-11-04,\"2,000\",settled,ach\nPAY-013,INV-013,2025-10-22,\"1,600\",settled,wire\nPAY-014,INV-014,2025-12-05,\"2,500\",pending,ach\nPAY-015,INV-015,2025-12-21,\"3,000\",settled,ach\n";
    "inputs/payroll.csv": "payroll_id,employee_id,function,pay_month,gross_pay,employer_tax,status\nPR-001,E-001,Engineering,2025-01,\"12,000\",\"1,200\",posted\nPR-002,E-002,Sales,2025-01,\"9,000\",900,posted\nPR-003,E-001,Engineering,2025-02,\"12,000\",\"1,200\",posted\nPR-004,E-002,Sales,2025-02,\"9,000\",900,posted\nPR-005,E-003,Customer Success,2025-04,\"7,500\",750,posted\nPR-006,E-001,Engineering,2025-06,\"12,000\",\"1,200\",posted\nPR-007,E-002,Sales,2025-06,\"9,000\",900,posted\nPR-008,E-003,Customer Success,2025-06,\"7,500\",750,posted\nPR-009,E-004,Engineering,2025-09,\"11,000\",\"1,100\",posted\nPR-010,E-001,Engineering,2025-12,\"12,000\",\"1,200\",posted\nPR-011,E-002,Sales,2025-12,\"9,000\",900,posted\nPR-012,E-003,Customer Success,2025-12,\"7,500\",750,posted\nPR-013,E-004,Engineering,2025-12,\"11,000\",\"1,100\",posted\n";
    "inputs/expenses.csv": "expense_id,expense_month,vendor,category,amount,status,updated_at\nEX-001,2025-01,AWS,Hosting,\"2,400\",approved,2025-01-31T10:00:00Z\nEX-002,2025-01,Notion,Software,300,approved,2025-01-31T10:00:00Z\nEX-003,2025-03,Legal LLP,Professional Services,\"4,500\",approved,2025-03-31T10:00:00Z\nEX-004,2025-06,AWS,Hosting,\"3,100\",approved,2025-06-30T10:00:00Z\nEX-005,2025-08,Conference Co,Marketing,\"6,000\",approved,2025-08-31T10:00:00Z\nEX-006,2025-10,AWS,Hosting,\"3,600\",approved,2025-10-31T10:00:00Z\nEX-007,2025-12,Insurance Inc,G&A,\"2,400\",approved,2025-12-31T10:00:00Z\nEX-005,2025-08,Conference Co,Marketing,\"5,200\",approved,2025-09-02T10:00:00Z\nEX-008,2025-12,AWS,Hosting,-400,credit,2025-12-31T10:00:00Z\n";
    "inputs/cash.csv": "transaction_id,transaction_date,description,amount,type,status\nCASH-OPEN,2025-01-01,Opening cash,\"420,000\",opening,posted\nCASH-001,2025-01-31,Customer receipts,\"4,200\",inflow,posted\nCASH-002,2025-01-31,Payroll and vendors,\"-24,800\",outflow,posted\nCASH-003,2025-03-31,Customer receipts,\"2,650\",inflow,posted\nCASH-004,2025-03-31,Payroll and vendors,\"-27,000\",outflow,posted\nCASH-005,2025-06-30,Customer receipts,\"1,800\",inflow,posted\nCASH-006,2025-06-30,Payroll and vendors,\"-37,550\",outflow,posted\nCASH-007,2025-09-30,Customer receipts,\"8,300\",inflow,posted\nCASH-008,2025-09-30,Payroll and vendors,\"-48,000\",outflow,posted\nCASH-009,2025-12-31,Customer receipts,\"6,600\",inflow,posted\nCASH-010,2025-12-31,Payroll and vendors,\"-51,850\",outflow,posted\n";
}>;
export declare const SAAS_VISIBLE_TASK = "Build an executive-ready SaaS operating model from the six CSV exports in inputs/ and deliver exactly one workbook at deliverables/saas-operating-model.xlsx. Commit the finished workbook and supporting scripts, leave the workspace clean, and do not push or publish anything.\n\nThe workbook must use formulas rather than pasted calculated answers and must contain source tabs, reconciled monthly 2025 historicals, subscription revenue and churn analysis, a January-December 2026 forecast, Base/Upside/Downside operating scenarios, cash runway, visible checks, and an executive dashboard with formula-backed charts. Keep assumptions editable and clearly distinguished from formulas.\n\nUse these definitions: trim fields and compare statuses/currency case-insensitively; for duplicate business IDs keep the row with the latest updated_at; USD only; net recognized revenue is final invoice subtotal plus credit by service_month and excludes tax; settled payments are cash collections; ending MRR is monthly_amount for subscriptions active at month end after the latest revision; logo churn is customers active at the prior month end but not the current month end; gross revenue churn includes churned and contracted opening MRR; NRR equals opening MRR less churn and contraction plus expansion, divided by opening MRR. Forecast twelve months after December 2025. Show Base, Upside, and Downside using visibly different new-MRR, churn, payroll, and opex assumptions. Runway is the first forecast month with ending cash below zero, or \u201C12+ months\u201D. Historical cash follows the posted cash export; forecast cash rolls forward from December 2025 ending cash.\n\nFor layout-independent audit, place each required calculated output beside a unique text key in the immediately adjacent cell. Use keys actual_revenue_YYYY-MM, actual_collections_YYYY-MM, ending_mrr_YYYY-MM, logo_churn_YYYY-MM, gross_revenue_churn_YYYY-MM, nrr_YYYY-MM, actual_payroll_YYYY-MM, actual_opex_YYYY-MM, ending_cash_YYYY-MM, scenario_<base|upside|downside>_revenue_YYYY-MM, scenario_<scenario>_ending_cash_YYYY-MM, scenario_<scenario>_runway_months, dashboard_ltm_revenue, and dashboard_base_ending_cash. The adjacent derived values must be formulas. Put editable numeric scenario inputs beside unique keys assumption_<scenario>_new_mrr_growth, assumption_<scenario>_monthly_churn, assumption_<scenario>_monthly_payroll, assumption_<scenario>_monthly_opex, and assumption_<scenario>_collection_rate. Forecast revenue equals prior-month revenue \u00D7 (1 \u2212 churn) \u00D7 (1 + new-MRR growth); forecast ending cash equals prior ending cash + revenue \u00D7 collection rate \u2212 payroll \u2212 opex. A runway formula returns the first negative forecast month as YYYY-MM, otherwise \u201C12+ months\u201D. Include formula-driven model_status, check_source_coverage, check_cash_rollforward, and check_scenario_validity keys that show PASS when valid. Source tabs may be arranged freely but must preserve every canonical latest source record and all its fields. Do not add external workbook links.";
export declare const SAAS_OPERATING_MODEL_VERIFIER_SOURCE_SHA256 = "f894c512aa5b963fedb9e381647c2d0909342cd4a19fc1da29b004acd3cba967";
export declare const saasOperatingModelCase: import("@relayer/eval-runner").BoundAutonomousCase<Readonly<{
    schemaVersion: 1;
    id: "capability.spreadsheet.saas-operating-model";
    name: "Excel · SaaS operating model";
    description: "Builds an auditable SaaS operating model and executive dashboard from six messy exports.";
    localOnly: true;
    supportedPlatform: "darwin";
    autonomous: true;
    category: "work";
    taskType: "spreadsheet-model";
    fixture: Readonly<{
        source: "relayer-eval://saas-operating-model-inputs";
        revision: `sha256:${string}`;
        packageManager: "node@24.19.0";
    }>;
    threads: readonly ProjectEvalThreadDefinition[];
}>>;
export declare const saasOperatingModelCaseIds: Set<string>;
export interface SaasFixtureReceipt {
    readonly schemaVersion: 1;
    readonly fixtureId: typeof SAAS_OPERATING_MODEL_CASE_ID;
    readonly workspaceDirectory: string;
    readonly repositoryUrl: string;
    readonly sourceRevision: string;
    readonly seededCommit: string;
    readonly seededTree: string;
    readonly packageManager: "node@24.19.0";
    readonly installedWithFrozenLockfile: false;
}
export declare function materializeSaasOperatingModelFixture(options: {
    readonly workspaceDirectory: string;
    readonly runtime: SpreadsheetRuntimePaths;
    readonly expectedRuntimeDigest?: string;
    readonly expectedNodeDigest?: string;
    readonly platform?: NodeJS.Platform;
    readonly runCommand: (command: string, args: readonly string[], options: {
        cwd: string;
        env?: Readonly<Record<string, string>>;
    }) => Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }>;
}): Promise<SaasFixtureReceipt>;
export declare function gradeSaasOperatingModelWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly baseRevision: string;
    readonly inspector: WorkbookInspector;
    readonly runCommand: (command: string, args: readonly string[], options: {
        cwd: string;
        env?: Readonly<Record<string, string>>;
    }) => Promise<{
        exitCode: number;
        stdout: string;
        stderr: string;
    }>;
}): Promise<readonly EvalCheck[]>;
