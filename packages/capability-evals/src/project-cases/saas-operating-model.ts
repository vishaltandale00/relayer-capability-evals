import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { bindAutonomousCaseSnapshot } from "@relayer/eval-runner";
import { createAutonomousCaseSnapshot } from "@relayer/eval-runner";
import type { EvalCheck } from "@relayer/eval-runner";
import type { ProjectEvalThreadDefinition } from "@relayer/eval-runner";
import { assertSpreadsheetRuntime, SPREADSHEET_ARTIFACT_INSPECTOR_SOURCE_SHA256, SPREADSHEET_NODE_CONTENT_DIGEST, SPREADSHEET_RUNTIME_CONTENT_DIGEST, type SpreadsheetRuntimePaths, type WorkbookCellSnapshot, type WorkbookInspection, type WorkbookInspector } from "./spreadsheet-artifact-inspector.js";

export const SAAS_OPERATING_MODEL_CASE_ID = "capability.spreadsheet.saas-operating-model";
export const SAAS_OPERATING_MODEL_FILENAME = "deliverables/saas-operating-model.xlsx";

const ACTUAL_MONTHS = Object.freeze(Array.from({ length: 12 }, (_, index) => `2025-${String(index + 1).padStart(2, "0")}`));
const FORECAST_MONTHS = Object.freeze(Array.from({ length: 12 }, (_, index) => `2026-${String(index + 1).padStart(2, "0")}`));
const SCENARIOS = Object.freeze(["base", "upside", "downside"] as const);

const subscriptions = `subscription_id,customer_id,plan,start_date,end_date,status,monthly_amount,currency,updated_at
 sub-001 ,C-001, Growth ,2024-11-01,,ACTIVE,"$1,200.00",usd,2025-01-02T09:00:00Z
sub-002,C-002,starter,2025/01/15,,active,$500,USD,2025-01-16T09:00:00Z
sub-003,C-003,GROWTH,2025-02-01,2025-08-31,cancelled,"1,500",USD,2025-09-01T09:00:00Z
sub-004,C-004,Enterprise,2024-06-01,,active,"$3,000",USD,2025-01-02T09:00:00Z
sub-005,C-005,Starter,2025-03-10,,active,$650,usd,2025-03-11T09:00:00Z
sub-006,C-006,Growth,2025-04-01,,active,"$1,800",USD,2025-04-02T09:00:00Z
sub-007,C-007,Starter,2025-01-01,2025-05-31,cancelled,$400,USD,2025-06-01T09:00:00Z
sub-008,C-008,Enterprise,2025-06-01,,active,"$4,200",USD,2025-06-02T09:00:00Z
sub-009,C-009,Growth,2025-07-01,,active,"$1,400",USD,2025-07-02T09:00:00Z
sub-010,C-010,Starter,2025-09-01,,active,$700,USD,2025-09-02T09:00:00Z
sub-006,C-006,Growth,2025-04-01,,active,"$2,000",USD,2025-10-01T09:00:00Z
sub-011,C-011,Growth,2025-10-01,,active,"$1,600",USD,2025-10-02T09:00:00Z
sub-012,C-012,Enterprise,2025-11-01,,active,"$5,000",USD,2025-11-02T09:00:00Z
sub-013,C-013,Growth,2025-01-01,2025-06-30,active,"$1,000",USD,2025-01-02T09:00:00Z
sub-014,C-013,Growth,2025-07-01,,active,"$1,250",USD,2025-07-02T09:00:00Z
sub-015,C-014,Growth,2025-02-01,2025-09-30,active,$900,USD,2025-02-02T09:00:00Z
sub-016,C-014,Growth,2025-10-01,,active,$700,USD,2025-10-02T09:00:00Z
`;

const invoices = `invoice_id,customer_id,service_month,subtotal,tax,credit,total,status,updated_at
INV-001,C-001,2025-01,"1,200",0,0,"1,200",paid,2025-01-31T12:00:00Z
INV-002,C-002,2025-01,500,0,0,500,PAID,2025-01-31T12:00:00Z
INV-003,C-004,2025-01,"3,000",0,0,"3,000",paid,2025-01-31T12:00:00Z
INV-004,C-003,2025-02,"1,500",0,0,"1,500",paid,2025-02-28T12:00:00Z
INV-005,C-005,2025-03,650,0,0,650,paid,2025-03-31T12:00:00Z
INV-006,C-006,2025-04,"1,800",0,0,"1,800",paid,2025-04-30T12:00:00Z
INV-007,C-007,2025-05,400,0,0,400,paid,2025-05-31T12:00:00Z
INV-008,C-008,2025-06,"4,200",0,0,"4,200",open,2025-06-30T12:00:00Z
INV-009,C-009,2025-07,"1,400",0,0,"1,400",paid,2025-07-31T12:00:00Z
INV-010,C-003,2025-08,"1,500",0,-300,"1,200",paid,2025-08-31T12:00:00Z
INV-011,C-010,2025-09,700,0,0,700,paid,2025-09-30T12:00:00Z
INV-012,C-006,2025-10,"2,000",0,0,"2,000",paid,2025-10-31T12:00:00Z
INV-013,C-011,2025-10,"1,600",0,0,"1,600",paid,2025-10-31T12:00:00Z
INV-014,C-012,2025-11,"5,000",0,0,"5,000",open,2025-11-30T12:00:00Z
INV-015,C-004,2025-12,"3,000",0,0,"3,000",paid,2025-12-31T12:00:00Z
INV-008,C-008,2025-06,"4,200",0,-200,"4,000",paid,2025-07-03T12:00:00Z
`;

const payments = `payment_id,invoice_id,paid_date,amount,status,method
PAY-001,INV-001,2025-01-20,"1,200",settled,ach
PAY-002,INV-002,2025-02-02,500,settled,card
PAY-003,INV-003,2025-01-25,"3,000",settled,wire
PAY-004,INV-004,2025-03-05,"1,500",settled,ach
PAY-005,INV-005,2025-03-25,650,settled,card
PAY-006,INV-006,2025-05-02,"1,800",settled,ach
PAY-007,INV-007,2025-05-28,400,settled,card
PAY-008,INV-008,2025-07-03,"4,000",settled,wire
PAY-009,INV-009,2025-07-20,"1,400",settled,ach
PAY-010,INV-010,2025-08-25,"1,200",settled,ach
PAY-011,INV-011,2025-10-02,700,settled,card
PAY-012,INV-012,2025-11-04,"2,000",settled,ach
PAY-013,INV-013,2025-10-22,"1,600",settled,wire
PAY-014,INV-014,2025-12-05,"2,500",pending,ach
PAY-015,INV-015,2025-12-21,"3,000",settled,ach
`;

const payroll = `payroll_id,employee_id,function,pay_month,gross_pay,employer_tax,status
PR-001,E-001,Engineering,2025-01,"12,000","1,200",posted
PR-002,E-002,Sales,2025-01,"9,000",900,posted
PR-003,E-001,Engineering,2025-02,"12,000","1,200",posted
PR-004,E-002,Sales,2025-02,"9,000",900,posted
PR-005,E-003,Customer Success,2025-04,"7,500",750,posted
PR-006,E-001,Engineering,2025-06,"12,000","1,200",posted
PR-007,E-002,Sales,2025-06,"9,000",900,posted
PR-008,E-003,Customer Success,2025-06,"7,500",750,posted
PR-009,E-004,Engineering,2025-09,"11,000","1,100",posted
PR-010,E-001,Engineering,2025-12,"12,000","1,200",posted
PR-011,E-002,Sales,2025-12,"9,000",900,posted
PR-012,E-003,Customer Success,2025-12,"7,500",750,posted
PR-013,E-004,Engineering,2025-12,"11,000","1,100",posted
`;

const expenses = `expense_id,expense_month,vendor,category,amount,status,updated_at
EX-001,2025-01,AWS,Hosting,"2,400",approved,2025-01-31T10:00:00Z
EX-002,2025-01,Notion,Software,300,approved,2025-01-31T10:00:00Z
EX-003,2025-03,Legal LLP,Professional Services,"4,500",approved,2025-03-31T10:00:00Z
EX-004,2025-06,AWS,Hosting,"3,100",approved,2025-06-30T10:00:00Z
EX-005,2025-08,Conference Co,Marketing,"6,000",approved,2025-08-31T10:00:00Z
EX-006,2025-10,AWS,Hosting,"3,600",approved,2025-10-31T10:00:00Z
EX-007,2025-12,Insurance Inc,G&A,"2,400",approved,2025-12-31T10:00:00Z
EX-005,2025-08,Conference Co,Marketing,"5,200",approved,2025-09-02T10:00:00Z
EX-008,2025-12,AWS,Hosting,-400,credit,2025-12-31T10:00:00Z
`;

const cash = `transaction_id,transaction_date,description,amount,type,status
CASH-OPEN,2025-01-01,Opening cash,"420,000",opening,posted
CASH-001,2025-01-31,Customer receipts,"4,200",inflow,posted
CASH-002,2025-01-31,Payroll and vendors,"-24,800",outflow,posted
CASH-003,2025-03-31,Customer receipts,"2,650",inflow,posted
CASH-004,2025-03-31,Payroll and vendors,"-27,000",outflow,posted
CASH-005,2025-06-30,Customer receipts,"1,800",inflow,posted
CASH-006,2025-06-30,Payroll and vendors,"-37,550",outflow,posted
CASH-007,2025-09-30,Customer receipts,"8,300",inflow,posted
CASH-008,2025-09-30,Payroll and vendors,"-48,000",outflow,posted
CASH-009,2025-12-31,Customer receipts,"6,600",inflow,posted
CASH-010,2025-12-31,Payroll and vendors,"-51,850",outflow,posted
`;

export const SAAS_SOURCE_FILES = Object.freeze({
  "inputs/subscriptions.csv": subscriptions,
  "inputs/invoices.csv": invoices,
  "inputs/payments.csv": payments,
  "inputs/payroll.csv": payroll,
  "inputs/expenses.csv": expenses,
  "inputs/cash.csv": cash,
});

export const SAAS_VISIBLE_TASK = `Build an executive-ready SaaS operating model from the six CSV exports in inputs/ and deliver exactly one workbook at ${SAAS_OPERATING_MODEL_FILENAME}. Commit the finished workbook and supporting scripts, leave the workspace clean, and do not push or publish anything.

The workbook must use formulas rather than pasted calculated answers and must contain source tabs, reconciled monthly 2025 historicals, subscription revenue and churn analysis, a January-December 2026 forecast, Base/Upside/Downside operating scenarios, cash runway, visible checks, and an executive dashboard with formula-backed charts. Keep assumptions editable and clearly distinguished from formulas.

Use these definitions: trim fields and compare statuses/currency case-insensitively; for duplicate business IDs keep the row with the latest updated_at; USD only; net recognized revenue is final invoice subtotal plus credit by service_month and excludes tax; settled payments are cash collections; ending MRR is monthly_amount for subscriptions active at month end after the latest revision; logo churn is customers active at the prior month end but not the current month end; gross revenue churn includes churned and contracted opening MRR; NRR equals opening MRR less churn and contraction plus expansion, divided by opening MRR. Forecast twelve months after December 2025. Show Base, Upside, and Downside using visibly different new-MRR, churn, payroll, and opex assumptions. Runway is the first forecast month with ending cash below zero, or “12+ months”. Historical cash follows the posted cash export; forecast cash rolls forward from December 2025 ending cash.

For layout-independent audit, place each required calculated output beside a unique text key in the immediately adjacent cell. Use keys actual_revenue_YYYY-MM, actual_collections_YYYY-MM, ending_mrr_YYYY-MM, logo_churn_YYYY-MM, gross_revenue_churn_YYYY-MM, nrr_YYYY-MM, actual_payroll_YYYY-MM, actual_opex_YYYY-MM, ending_cash_YYYY-MM, scenario_<base|upside|downside>_revenue_YYYY-MM, scenario_<scenario>_ending_cash_YYYY-MM, scenario_<scenario>_runway_months, dashboard_ltm_revenue, and dashboard_base_ending_cash. The adjacent derived values must be formulas. Put editable numeric scenario inputs beside unique keys assumption_<scenario>_new_mrr_growth, assumption_<scenario>_monthly_churn, assumption_<scenario>_monthly_payroll, assumption_<scenario>_monthly_opex, and assumption_<scenario>_collection_rate. Forecast revenue equals prior-month revenue × (1 − churn) × (1 + new-MRR growth); forecast ending cash equals prior ending cash + revenue × collection rate − payroll − opex. A runway formula returns the first negative forecast month as YYYY-MM, otherwise “12+ months”. Include formula-driven model_status, check_source_coverage, check_cash_rollforward, and check_scenario_validity keys that show PASS when valid. Source tabs may be arranged freely but must preserve every canonical latest source record and all its fields. Do not add external workbook links.`;

export const SAAS_OPERATING_MODEL_VERIFIER_SOURCE_SHA256 = "f894c512aa5b963fedb9e381647c2d0909342cd4a19fc1da29b004acd3cba967";

const hash = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
const fixtureDigest = hash(Object.entries(SAAS_SOURCE_FILES).map(([path, contents]) => `${path}\0${contents}`).join("\n"));
const runtimeIdentity = Object.freeze({ node: "24.19.0", nodeDigest: SPREADSHEET_NODE_CONTENT_DIGEST, artifactTool: "2.8.59", artifactToolDigest: SPREADSHEET_RUNTIME_CONTENT_DIGEST, workbookFormat: "xlsx", calculation: "artifact-tool-formula-engine", rendering: "artifact-tool-skia" });
const sourceIdColumns = { subscriptions: "subscription_id", invoices: "invoice_id", payments: "payment_id", payroll: "payroll_id", expenses: "expense_id", cash: "transaction_id" } as const;

const thread: ProjectEvalThreadDefinition = Object.freeze({
  id: "implementation",
  name: "Build SaaS operating model",
  permissionProfileId: "full",
  mutationPolicy: "writable",
  workspaceGrade: "autonomous-implementation",
  prompts: Object.freeze([SAAS_VISIBLE_TASK]),
});

const definition = Object.freeze({
  schemaVersion: 1 as const,
  id: SAAS_OPERATING_MODEL_CASE_ID,
  name: "Excel · SaaS operating model",
  description: "Builds an auditable SaaS operating model and executive dashboard from six messy exports.",
  localOnly: true as const,
  supportedPlatform: "darwin" as const,
  autonomous: true as const,
  category: "work" as const,
  taskType: "spreadsheet-model",
  fixture: Object.freeze({ source: "relayer-eval://saas-operating-model-inputs", revision: fixtureDigest, packageManager: "node@24.19.0" as const }),
  threads: Object.freeze([thread]),
});

const gates = Object.freeze([
  { id: "source-coverage", label: "Source coverage", description: "Every canonical latest source record is represented in workbook source tabs." },
  { id: "historical-reconciliation", label: "Historical reconciliation", description: "Revenue, churn, payroll, opex, collections, and cash independently reconcile." },
  { id: "forecast-scenarios", label: "Forecast and scenarios", description: "Twelve months and three materially different formula-driven scenarios independently reconcile." },
  { id: "cash-runway", label: "Cash runway", description: "Cash rolls forward and runway follows the visible definition." },
  { id: "formula-lineage", label: "Formula lineage", description: "Material outputs and dashboard values are formulas with workbook lineage." },
  { id: "workbook-rendering", label: "Workbook rendering", description: "All workbook sheets render and the dashboard contains visible chart output." },
  { id: "changed-input-response", label: "Changed-input response", description: "Selected source and assumption mutations recalculate material outputs." },
  { id: "scoped-delivery", label: "Scoped committed delivery", description: "The requested workbook is committed and the workspace is clean." },
]);

const criteria = Object.freeze([
  { id: "financial-correctness", label: "Financial correctness", description: "The operating model is correct, reconciled, and decision-useful.", weight: 3 },
  { id: "auditability", label: "Auditability", description: "Inputs, assumptions, formulas, checks, and sources are easy to trace.", weight: 2 },
  { id: "executive-usability", label: "Executive usability", description: "The dashboard communicates trends, scenarios, and runway clearly.", weight: 1 },
]);

export const saasOperatingModelCase = bindAutonomousCaseSnapshot(definition, createAutonomousCaseSnapshot({
  id: definition.id,
  name: definition.name,
  description: definition.description,
  category: definition.category,
  taskType: definition.taskType,
  artifacts: {
    task: { kind: "visible-task", text: SAAS_VISIBLE_TASK, contentDigest: hash(SAAS_VISIBLE_TASK) },
    workspace: { kind: "frozen-workspace", materializerId: "saas-operating-model-v1", source: definition.fixture.source, revision: definition.fixture.revision, contentDigest: fixtureDigest, environmentDigest: hash(JSON.stringify(runtimeIdentity)) },
    reference: { kind: "sealed-reference", artifactId: "saas-operating-model-reference-v1", format: "json", contentDigest: hash(JSON.stringify({ actualMonths: ACTUAL_MONTHS, forecastMonths: FORECAST_MONTHS, scenarios: SCENARIOS, definitions: SAAS_VISIBLE_TASK })), sealedPath: "packages/capability-evals/src/project-cases/saas-operating-model.ts" },
    verifier: { kind: "sealed-verifier", artifactId: "saas-operating-model-verifier-v1", verifierId: "saas-operating-model-v1", contentDigest: hash([SAAS_OPERATING_MODEL_VERIFIER_SOURCE_SHA256, SPREADSHEET_ARTIFACT_INSPECTOR_SOURCE_SHA256, JSON.stringify({ gates, ACTUAL_MONTHS, FORECAST_MONTHS, SCENARIOS, sourceIdColumns, SAAS_OPERATING_MODEL_FILENAME, runtimeIdentity }), fixtureDigest].join("\n")), sealedPath: "packages/capability-evals/src/project-cases/saas-operating-model.ts", mandatoryGates: gates },
    outcomeRubric: { kind: "outcome-rubric", rubricVersion: "saas-operating-model-outcome-v1", criteria, contentDigest: hash(JSON.stringify(criteria)) },
  },
}));

export const saasOperatingModelCaseIds = new Set([SAAS_OPERATING_MODEL_CASE_ID]);

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

export async function materializeSaasOperatingModelFixture(options: {
  readonly workspaceDirectory: string;
  readonly runtime: SpreadsheetRuntimePaths;
  readonly expectedRuntimeDigest?: string;
  readonly expectedNodeDigest?: string;
  readonly platform?: NodeJS.Platform;
  readonly runCommand: (command: string, args: readonly string[], options: { cwd: string; env?: Readonly<Record<string, string>> }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}): Promise<SaasFixtureReceipt> {
  if ((options.platform ?? process.platform) !== "darwin") throw new Error("The SaaS operating model case is local Mac only.");
  await expectMissing(options.workspaceDirectory);
  await validateRuntime(options.runtime, options.expectedRuntimeDigest, options.expectedNodeDigest);
  await mkdir(options.workspaceDirectory, { recursive: true, mode: 0o700 });
  for (const [relativePath, contents] of Object.entries(SAAS_SOURCE_FILES)) {
    const target = join(options.workspaceDirectory, relativePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, contents, "utf8");
  }
  await writeFile(join(options.workspaceDirectory, "README.md"), `# SaaS operating model case\n\n${SAAS_VISIBLE_TASK}\n`, "utf8");
  await writeFile(join(options.workspaceDirectory, ".gitignore"), "node_modules\n.relayerspreadsheet/\n", "utf8");
  await required(options.runCommand, "git", ["init", "--quiet", "--initial-branch=main"], options.workspaceDirectory);
  await required(options.runCommand, "git", ["config", "user.name", "Relayer Eval Fixture"], options.workspaceDirectory);
  await required(options.runCommand, "git", ["config", "user.email", "eval-fixture@relayer.local"], options.workspaceDirectory);
  await required(options.runCommand, "git", ["add", "--all"], options.workspaceDirectory);
  const env = { GIT_AUTHOR_DATE: "2026-08-28T12:00:00Z", GIT_COMMITTER_DATE: "2026-08-28T12:00:00Z" };
  await required(options.runCommand, "git", ["commit", "--quiet", "-m", `Seed ${SAAS_OPERATING_MODEL_CASE_ID}`], options.workspaceDirectory, env);
  const nodeVersion = (await required(options.runCommand, options.runtime.nodeExecutable, ["--version"], options.workspaceDirectory)).stdout.trim();
  if (nodeVersion !== "v24.19.0") throw new Error(`Spreadsheet runtime requires Node v24.19.0, received ${nodeVersion || "no version"}.`);
  await mkdir(join(options.workspaceDirectory, "node_modules", "@oai"), { recursive: true });
  await cp(join(options.runtime.nodeModulesDirectory, "@oai", "artifact-tool"), join(options.workspaceDirectory, "node_modules", "@oai", "artifact-tool"), { recursive: true, dereference: false });
  const seededCommit = (await required(options.runCommand, "git", ["rev-parse", "HEAD"], options.workspaceDirectory)).stdout.trim();
  const seededTree = (await required(options.runCommand, "git", ["rev-parse", "HEAD^{tree}"], options.workspaceDirectory)).stdout.trim();
  return Object.freeze({ schemaVersion: 1 as const, fixtureId: SAAS_OPERATING_MODEL_CASE_ID, workspaceDirectory: options.workspaceDirectory, repositoryUrl: definition.fixture.source, sourceRevision: definition.fixture.revision, seededCommit, seededTree, packageManager: "node@24.19.0" as const, installedWithFrozenLockfile: false as const });
}

export async function gradeSaasOperatingModelWorkspace(options: {
  readonly workspaceDirectory: string;
  readonly baseRevision: string;
  readonly inspector: WorkbookInspector;
  readonly runCommand: (command: string, args: readonly string[], options: { cwd: string; env?: Readonly<Record<string, string>> }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}): Promise<readonly EvalCheck[]> {
  const workbookPath = join(options.workspaceDirectory, SAAS_OPERATING_MODEL_FILENAME);
  const present = await access(workbookPath).then(() => true, () => false);
  let inspection: WorkbookInspection | null = null;
  let inspectionError = "";
  if (present) {
    try { inspection = await options.inspector.inspect(workbookPath); } catch (error) { inspectionError = error instanceof Error ? error.message : String(error); }
  }
  const cells = inspection?.sheets.flatMap((sheet) => sheet.cells) ?? [];
  const keyOccurrences = new Map<string, WorkbookCellSnapshot[]>();
  for (const cell of cells.filter((candidate) => typeof candidate.value === "string")) { const key = String(cell.value).trim(); const occurrences = keyOccurrences.get(key) ?? []; occurrences.push(cell); keyOccurrences.set(key, occurrences); }
  const adjacent = (key: string) => {
    const occurrences = keyOccurrences.get(key); const label = occurrences?.length === 1 ? occurrences[0] : undefined;
    return label && cells.find((cell) => cell.sheet === label.sheet && cell.row === label.row && cell.column === label.column + 1);
  };
  const requiredKeys = [
    ...ACTUAL_MONTHS.flatMap((month) => [`actual_revenue_${month}`, `actual_collections_${month}`, `ending_mrr_${month}`, `logo_churn_${month}`, `gross_revenue_churn_${month}`, `nrr_${month}`, `actual_payroll_${month}`, `actual_opex_${month}`, `ending_cash_${month}`]),
    ...SCENARIOS.flatMap((scenario) => FORECAST_MONTHS.flatMap((month) => [`scenario_${scenario}_revenue_${month}`, `scenario_${scenario}_ending_cash_${month}`])),
    ...SCENARIOS.map((scenario) => `scenario_${scenario}_runway_months`), "dashboard_ltm_revenue", "dashboard_base_ending_cash", "model_status", "check_source_coverage", "check_cash_rollforward", "check_scenario_validity",
  ];
  const found = requiredKeys.map((key) => ({ key, cell: adjacent(key) }));
  const duplicateKeys = requiredKeys.filter((key) => (keyOccurrences.get(key)?.length ?? 0) > 1);
  const formulaCoverage = found.filter(({ cell }) => cell && cell.formula.startsWith("=")).length;
  const renderOkay = Boolean(inspection && inspection.sheets.length >= 7 && inspection.sheets.every((sheet) => sheet.renderBytes > 2_000));
  const dashboardDrawings = inspection?.sheets.filter((sheet) => /dashboard/i.test(sheet.name)).reduce((sum, sheet) => sum + sheet.drawingCount, 0) ?? 0;
  const dashboardChartSeries = inspection?.sheets.filter((sheet) => /dashboard/i.test(sheet.name)).reduce((sum, sheet) => sum + (sheet.chartSeriesFormulaCount ?? 0), 0) ?? 0;
  const dashboardSeriesBound = inspection?.sheets.filter((sheet) => /dashboard/i.test(sheet.name)).flatMap((sheet) => (sheet.chartSeriesFormulas ?? []).map((series) => Boolean(series.formula.includes("!") && series.categoryFormula.includes("!")))) ?? [];
  const sourceNames = ["subscriptions", "invoices", "payments", "payroll", "expenses", "cash"];
  const sourceChecks = sourceNames.map((name) => {
    const ids = canonicalIds(name as keyof typeof sourceIdColumns);
    const workbookIds = new Set(cells.filter((cell) => typeof cell.value === "string").map((cell) => String(cell.value).trim()).filter((value) => ids.has(value)));
    return { name, passed: workbookIds.size === ids.size, detail: `${workbookIds.size}/${ids.size} canonical ${name} IDs found.` };
  });
  const sourceRowChecks = sourceNames.map((name) => ({ name, ...sourceRowsCovered(name as keyof typeof sourceIdColumns, cells) }));
  const actualKeys = found.filter(({ key }) => /^(actual_|ending_mrr_|logo_churn_|gross_revenue_churn_|nrr_|ending_cash_)/.test(key));
  const scenarioKeys = found.filter(({ key }) => /^scenario_(base|upside|downside)_(revenue|ending_cash)_/.test(key));
  const distinctScenarioMonths = FORECAST_MONTHS.filter((month) => {
    const values = SCENARIOS.map((scenario) => adjacent(`scenario_${scenario}_revenue_${month}`)?.value);
    return values.every((value) => typeof value === "number") && new Set(values.map((value) => Number(value).toFixed(2))).size === SCENARIOS.length;
  });
  const distinctScenarioDrivers = ["new_mrr_growth", "monthly_churn", "monthly_payroll", "monthly_opex"].filter((driver) => new Set(SCENARIOS.map((scenario) => numericAdjacent(adjacent(`assumption_${scenario}_${driver}`)))).size === SCENARIOS.length);
  const cashKeys = found.filter(({ key }) => key.includes("ending_cash"));
  const expected = independentHistoricals();
  const historicalMismatches = Object.entries(expected).filter(([key, value]) => !approximately(adjacent(key)?.value, value)).map(([key]) => key);
  const scenarioMismatches: string[] = [];
  const runwayMismatches: string[] = [];
  let expectedBaseEndingCash: number | null = null;
  for (const scenario of SCENARIOS) {
    const growth = numericAdjacent(adjacent(`assumption_${scenario}_new_mrr_growth`));
    const churn = numericAdjacent(adjacent(`assumption_${scenario}_monthly_churn`));
    const payroll = numericAdjacent(adjacent(`assumption_${scenario}_monthly_payroll`));
    const opex = numericAdjacent(adjacent(`assumption_${scenario}_monthly_opex`));
    const collection = numericAdjacent(adjacent(`assumption_${scenario}_collection_rate`));
    if ([growth, churn, payroll, opex, collection].some((value) => value === null)) { scenarioMismatches.push(`${scenario}:assumptions`); continue; }
    let revenue = expected["ending_mrr_2025-12"]!; let cashBalance = expected["ending_cash_2025-12"]!; let firstNegative: string | null = null;
    for (const month of FORECAST_MONTHS) {
      revenue = revenue * (1 - churn!) * (1 + growth!); cashBalance += revenue * collection! - payroll! - opex!;
      if (!approximately(adjacent(`scenario_${scenario}_revenue_${month}`)?.value, revenue)) scenarioMismatches.push(`scenario_${scenario}_revenue_${month}`);
      if (!approximately(adjacent(`scenario_${scenario}_ending_cash_${month}`)?.value, cashBalance)) scenarioMismatches.push(`scenario_${scenario}_ending_cash_${month}`);
      if (cashBalance < 0 && firstNegative === null) firstNegative = month;
    }
    if (scenario === "base") expectedBaseEndingCash = cashBalance;
    if (adjacent(`scenario_${scenario}_runway_months`)?.value !== (firstNegative ?? "12+ months")) runwayMismatches.push(scenario);
  }
  const formulasWithExternalLinks = cells.filter((cell) => /\[[^\]]+\.(?:xlsx|xlsm|xlsb|xls)\]/i.test(cell.formula)).map((cell) => `${cell.sheet}:${cell.row + 1}:${cell.column + 1}`);
  let externalPackageParts: string[] = [];
  if (present) { const packageResult = await options.runCommand("unzip", ["-Z1", workbookPath], { cwd: options.workspaceDirectory }); const packageEntries = packageResult.stdout.split(/\r?\n/); externalPackageParts = packageResult.exitCode === 0 ? packageEntries.filter((entry) => /(?:^|\/)externalLinks\/|connections\.xml$/i.test(entry)) : ["uninspectable-xlsx-package"]; }
  const formulasWithoutReferences = found.filter(({ key, cell }) => {
    if (!cell?.formula.startsWith("=")) return false;
    const mustReference = key.startsWith("scenario_") || key.startsWith("dashboard_") || key.startsWith("check_") || key === "model_status" || (key in expected && ![0, 1].includes(expected[key]!));
    return mustReference && !/(?:\$?[A-Z]{1,3}\$?\d+)|!/.test(cell.formula);
  }).map(({ key }) => key);
  const forbiddenFormulaFunctions = cells.filter((cell) => /\b(?:INDIRECT|WEBSERVICE|RTD)\s*\(/i.test(cell.formula)).map((cell) => `${cell.sheet}:${cell.row + 1}:${cell.column + 1}`);
  const formulaErrors = cells.filter((cell) => typeof cell.value === "string" && /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)$/.test(cell.value)).map((cell) => `${cell.sheet}:${cell.row + 1}:${cell.column + 1}`);
  const expectedLtmRevenue = ACTUAL_MONTHS.reduce((sum, month) => sum + expected[`actual_revenue_${month}`]!, 0);
  const dashboardMismatches = [
    ...(!approximately(adjacent("dashboard_ltm_revenue")?.value, expectedLtmRevenue) ? ["dashboard_ltm_revenue"] : []),
    ...(!approximately(adjacent("dashboard_base_ending_cash")?.value, expectedBaseEndingCash ?? Number.NaN) ? ["dashboard_base_ending_cash"] : []),
  ];
  const checkFailures = ["model_status", "check_source_coverage", "check_cash_rollforward", "check_scenario_validity"].filter((key) => adjacent(key)?.value !== "PASS");
  let mutationPassed = false;
  let mutationDetail = "Workbook unavailable for mutation.";
  if (inspection) {
    const sourceValue = (id: string, header: string) => { const idCell = cells.find((cell) => String(cell.value).trim() === id); const headerCell = idCell && cells.find((cell) => cell.sheet === idCell.sheet && String(cell.value).trim() === header); return idCell && headerCell && cells.find((cell) => cell.sheet === idCell.sheet && cell.row === idCell.row && cell.column === headerCell.column); };
    const sourceMutations: { cell: WorkbookCellSnapshot | undefined; delta: number; output: string; value?: number | string }[] = [
      { cell: sourceValue("INV-008", "subtotal"), delta: 1_000, output: "actual_revenue_2025-06" },
      { cell: sourceValue("PAY-001", "amount"), delta: 100, output: "actual_collections_2025-01" },
      { cell: sourceValue("PR-001", "gross_pay"), delta: 100, output: "actual_payroll_2025-01" },
      { cell: sourceValue("EX-001", "amount"), delta: 100, output: "actual_opex_2025-01" },
      { cell: sourceValue("CASH-001", "amount"), delta: 100, output: "ending_cash_2025-01" },
      { cell: sourceValue("sub-012", "monthly_amount"), delta: 500, output: "ending_mrr_2025-12" },
      { cell: sourceValue("sub-003", "end_date"), delta: -1, output: "logo_churn_2025-09", value: "2025-09-30" },
    ];
    const growthLabel = keyOccurrences.get("assumption_base_new_mrr_growth")?.length === 1 ? keyOccurrences.get("assumption_base_new_mrr_growth")![0] : undefined;
    const growthCell = growthLabel && cells.find((cell) => cell.sheet === growthLabel.sheet && cell.row === growthLabel.row && cell.column === growthLabel.column + 1);
    if (sourceMutations.every(({ cell, value }) => Boolean(cell) && (value !== undefined || typeof cell?.value === "number")) && growthCell && typeof growthCell.value === "number") {
      try {
        const mutated = await options.inspector.mutateAndInspect(workbookPath, [...sourceMutations.map(({ cell, delta, value }) => ({ sheet: cell!.sheet, row: cell!.row, column: cell!.column, value: value ?? Number(cell!.value) + delta })), { sheet: growthCell.sheet, row: growthCell.row, column: growthCell.column, value: growthCell.value + 0.01 }]);
        const mutatedCells = mutated.sheets.flatMap((sheet) => sheet.cells);
        const mutatedAdjacent = (key: string) => { const labels = mutatedCells.filter((cell) => cell.value === key); const label = labels.length === 1 ? labels[0] : undefined; return label && mutatedCells.find((cell) => cell.sheet === label.sheet && cell.row === label.row && cell.column === label.column + 1); };
        const mutationFailures = sourceMutations.filter(({ delta, output }) => { const baseline = adjacent(output); const changed = mutatedAdjacent(output); return !(typeof baseline?.value === "number" && typeof changed?.value === "number" && approximately(changed.value - baseline.value, delta)); }).map(({ output }) => output);
        for (const [output, wanted] of [["gross_revenue_churn_2025-09", 0], ["nrr_2025-09", 1]] as const) if (!approximately(mutatedAdjacent(output)?.value, wanted)) mutationFailures.push(output);
        const baseJanuary = adjacent("scenario_base_revenue_2026-01"); const changedJanuaryLabel = mutatedCells.find((cell) => cell.value === "scenario_base_revenue_2026-01"); const changedJanuary = changedJanuaryLabel && mutatedCells.find((cell) => cell.sheet === changedJanuaryLabel.sheet && cell.row === changedJanuaryLabel.row && cell.column === changedJanuaryLabel.column + 1);
        const churn = numericAdjacent(adjacent("assumption_base_monthly_churn")) ?? 0; const growth = numericAdjacent(adjacent("assumption_base_new_mrr_growth")) ?? 0; const expectedForecastDelta = (expected["ending_mrr_2025-12"]! + 500) * (1 - churn) * (1 + growth + 0.01) - expected["ending_mrr_2025-12"]! * (1 - churn) * (1 + growth);
        const forecastResponded = typeof baseJanuary?.value === "number" && typeof changedJanuary?.value === "number" && approximately(changedJanuary.value - baseJanuary.value, expectedForecastDelta);
        mutationPassed = mutationFailures.length === 0 && forecastResponded;
        mutationDetail = mutationPassed ? "Invoice, collections, payroll, opex, cash, subscription MRR/churn, and Base growth mutations produced independently predicted responses." : `Mutation response mismatch: ${[...mutationFailures, ...(!forecastResponded ? ["scenario_base_revenue_2026-01"] : [])].join(", ")}.`;
      } catch (error) { mutationDetail = error instanceof Error ? error.message : String(error); }
    } else mutationDetail = "Could not locate all representative source fields and the Base growth input for mutation.";
  }
  const status = (await required(options.runCommand, "git", ["status", "--porcelain=v1", "--untracked-files=all"], options.workspaceDirectory)).stdout.trim();
  const commits = (await required(options.runCommand, "git", ["rev-list", `${options.baseRevision}..HEAD`], options.workspaceDirectory)).stdout.trim().split(/\r?\n/).filter(Boolean);
  const trackedWorkbooks = (await required(options.runCommand, "git", ["ls-files", "--", "*.xlsx"], options.workspaceDirectory)).stdout.trim().split(/\r?\n/).filter(Boolean);
  const filesystemWorkbooks = (await required(options.runCommand, "find", [".", "-type", "f", "-name", "*.xlsx"], options.workspaceDirectory)).stdout.trim().split(/\r?\n/).filter(Boolean).map((path) => path.replace(/^\.\//, ""));
  return Object.freeze([
    ...sourceChecks.map((check) => ({ name: `workspace:source-coverage:${check.name}`, passed: check.passed, detail: check.detail })),
    ...sourceRowChecks.map((check) => ({ name: `workspace:source-coverage:${check.name}-rows`, passed: check.passed, detail: check.detail })),
    { name: "workspace:historical-reconciliation:keys", passed: actualKeys.every(({ cell }) => typeof cell?.value === "number"), detail: `${actualKeys.filter(({ cell }) => typeof cell?.value === "number").length}/${actualKeys.length} historical outputs are numeric.` },
    { name: "workspace:historical-reconciliation:independent-values", passed: historicalMismatches.length === 0, detail: historicalMismatches.length ? `Mismatched outputs: ${historicalMismatches.join(", ")}.` : "All material historical outputs match independent source recomputation." },
    { name: "workspace:forecast-scenarios:keys", passed: scenarioKeys.every(({ cell }) => typeof cell?.value === "number"), detail: `${scenarioKeys.filter(({ cell }) => typeof cell?.value === "number").length}/${scenarioKeys.length} scenario outputs are numeric.` },
    { name: "workspace:forecast-scenarios:materially-different", passed: distinctScenarioMonths.length >= 6, detail: `${distinctScenarioMonths.length}/12 forecast months have three distinct scenario revenues.` },
    { name: "workspace:forecast-scenarios:distinct-drivers", passed: distinctScenarioDrivers.length === 4, detail: `${distinctScenarioDrivers.length}/4 required scenario drivers differ across all scenarios.` },
    { name: "workspace:forecast-scenarios:independent-values", passed: scenarioMismatches.length === 0, detail: scenarioMismatches.length ? `Mismatched scenario outputs: ${scenarioMismatches.slice(0, 12).join(", ")}.` : "All scenario revenues and cash balances match independent recomputation." },
    { name: "workspace:cash-runway:keys", passed: cashKeys.every(({ cell }) => typeof cell?.value === "number") && SCENARIOS.every((scenario) => typeof adjacent(`scenario_${scenario}_runway_months`)?.value === "string"), detail: "Cash outputs are numeric and runway outputs use the visible text contract." },
    { name: "workspace:cash-runway:independent-values", passed: runwayMismatches.length === 0, detail: runwayMismatches.length ? `Runway mismatch: ${runwayMismatches.join(", ")}.` : "Scenario runway values match independently projected cash." },
    { name: "workspace:formula-lineage:required-outputs", passed: formulaCoverage === requiredKeys.length, detail: `${formulaCoverage}/${requiredKeys.length} required outputs contain formulas.` },
    { name: "workspace:formula-lineage:unique-keys", passed: duplicateKeys.length === 0, detail: duplicateKeys.length ? `Duplicate audit keys: ${duplicateKeys.join(", ")}.` : "Every audit key occurs exactly once." },
    { name: "workspace:formula-lineage:cell-references", passed: formulasWithoutReferences.length === 0, detail: formulasWithoutReferences.length ? `Outputs without cell/range lineage: ${formulasWithoutReferences.join(", ")}.` : "Every required formula references workbook cells or ranges." },
    { name: "workspace:formula-lineage:no-external-links", passed: formulasWithExternalLinks.length === 0, detail: formulasWithExternalLinks.length ? `External links: ${formulasWithExternalLinks.join(", ")}.` : "No external workbook formulas found." },
    { name: "workspace:formula-lineage:no-external-package-parts", passed: externalPackageParts.length === 0, detail: externalPackageParts.length ? `External OOXML parts: ${externalPackageParts.join(", ")}.` : "No external-link or connection OOXML parts found." },
    { name: "workspace:formula-lineage:no-dynamic-external-functions", passed: forbiddenFormulaFunctions.length === 0, detail: forbiddenFormulaFunctions.length ? `Forbidden dynamic formulas: ${forbiddenFormulaFunctions.join(", ")}.` : "No dynamic external formula functions found." },
    { name: "workspace:formula-lineage:no-formula-errors", passed: formulaErrors.length === 0, detail: formulaErrors.length ? `Formula errors: ${formulaErrors.join(", ")}.` : "No formula error values found." },
    { name: "workspace:formula-lineage:dashboard-values", passed: dashboardMismatches.length === 0, detail: dashboardMismatches.length ? `Dashboard mismatch: ${dashboardMismatches.join(", ")}.` : "Dashboard outputs match independent recomputation." },
    { name: "workspace:formula-lineage:visible-checks", passed: checkFailures.length === 0, detail: checkFailures.length ? `Non-passing checks: ${checkFailures.join(", ")}.` : "All visible workbook checks show PASS." },
    { name: "workspace:workbook-rendering:all-sheets", passed: renderOkay, detail: inspectionError || `${inspection?.sheets.length ?? 0} sheets rendered.` },
    { name: "workspace:workbook-rendering:dashboard-chart", passed: dashboardDrawings >= 1, detail: `${dashboardDrawings} dashboard drawing(s) found.` },
    { name: "workspace:workbook-rendering:dashboard-chart-series", passed: dashboardChartSeries >= 3, detail: `${dashboardChartSeries} formula-backed dashboard chart series found.` },
    { name: "workspace:workbook-rendering:dashboard-chart-binding", passed: dashboardSeriesBound.length >= 3 && dashboardSeriesBound.every(Boolean), detail: `${dashboardSeriesBound.filter(Boolean).length}/${dashboardSeriesBound.length} dashboard series bind both values and categories to dashboard ranges.` },
    { name: "workspace:changed-input-response:invoice", passed: mutationPassed, detail: mutationDetail },
    { name: "workspace:required-delivery-files", passed: present && trackedWorkbooks.length === 1 && trackedWorkbooks[0] === SAAS_OPERATING_MODEL_FILENAME && filesystemWorkbooks.length === 1 && filesystemWorkbooks[0] === SAAS_OPERATING_MODEL_FILENAME, detail: present ? `${trackedWorkbooks.length} tracked and ${filesystemWorkbooks.length} total workbook(s).` : "Workbook is missing." },
    { name: "workspace:delivery-commit", passed: commits.length >= 1, detail: `${commits.length} post-fixture commit(s).` },
    { name: "workspace:delivery-clean", passed: status === "", detail: status || "Workspace is clean." },
  ]);
}

function canonicalIds(name: keyof typeof sourceIdColumns): Set<string> {
  const text = SAAS_SOURCE_FILES[`inputs/${name}.csv` as keyof typeof SAAS_SOURCE_FILES];
  const rows = text.trim().split(/\r?\n/).slice(1).map((line) => parseCsvLine(line));
  const latest = new Map<string, string[]>();
  for (const row of rows) latest.set(row[0]!.trim(), row);
  return new Set(latest.keys());
}
function parseCsvLine(line: string): string[] {
  const values: string[] = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const char = line[index]!; if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { values.push(value); value = ""; } else value += char; }
  values.push(value); return values;
}
function money(value: string): number { return Number(value.replace(/[$,\s]/g, "")); }
function canonicalRows(name: keyof typeof sourceIdColumns): string[][] { const text = SAAS_SOURCE_FILES[`inputs/${name}.csv` as keyof typeof SAAS_SOURCE_FILES]; const latest = new Map<string, string[]>(); for (const line of text.trim().split(/\r?\n/).slice(1)) { const row = parseCsvLine(line).map((value) => value.trim()); latest.set(row[0]!, row); } return [...latest.values()]; }
function normalizedCell(value: unknown): string {
  if (typeof value === "number") return Number.isFinite(value) ? String(Number(value.toFixed(8))) : "";
  const normalized = String(value ?? "").trim().replace(/[$,\s]/g, "").toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}z$/.test(normalized)) return String(Number((Date.parse(normalized) / 86_400_000 + 25_569).toFixed(8)));
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? String(Number(normalized)) : normalized;
}
function equivalentCell(actual: unknown, expected: string): boolean {
  if (normalizedCell(actual) === normalizedCell(expected)) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(expected) && typeof actual === "number") return normalizedCell(actual) === String(Number((Date.parse(`${expected}T00:00:00Z`) / 86_400_000 + 25_569).toFixed(8)));
  return false;
}
function sourceRowsCovered(name: keyof typeof sourceIdColumns, cells: readonly WorkbookCellSnapshot[]): { passed: boolean; detail: string } {
  const text = SAAS_SOURCE_FILES[`inputs/${name}.csv` as keyof typeof SAAS_SOURCE_FILES];
  const headers = parseCsvLine(text.trim().split(/\r?\n/)[0]!).map((value) => value.trim());
  const expectedRows = canonicalRows(name); const cellsBySheet = new Map<string, Map<number, WorkbookCellSnapshot[]>>();
  for (const cell of cells) { const sheet = cellsBySheet.get(cell.sheet) ?? new Map<number, WorkbookCellSnapshot[]>(); const row = sheet.get(cell.row) ?? []; row.push(cell); sheet.set(cell.row, row); cellsBySheet.set(cell.sheet, sheet); }
  for (const rows of cellsBySheet.values()) for (const [headerRowNumber, headerRow] of rows) {
    const headerColumns = new Map(headerRow.map((cell) => [normalizedCell(cell.value), cell.column]));
    if (!headers.every((header) => headerColumns.has(normalizedCell(header)))) continue;
    const idColumn = headerColumns.get(normalizedCell(headers[0]))!; const dataRows: WorkbookCellSnapshot[][] = [];
    for (let rowNumber = headerRowNumber + 1; rows.has(rowNumber); rowNumber += 1) { const row = rows.get(rowNumber)!; if (!row.some((cell) => cell.column === idColumn && normalizedCell(cell.value))) break; dataRows.push(row); }
    const matched = expectedRows.filter((expected) => dataRows.some((row) => {
      const byColumn = new Map(row.map((cell) => [cell.column, cell.value]));
      return expected.every((value, index) => equivalentCell(byColumn.get(headerColumns.get(normalizedCell(headers[index]!))!), value));
    })).length;
    const uniqueIds = new Set(dataRows.map((row) => normalizedCell(row.find((cell) => cell.column === idColumn)?.value)));
    const exact = matched === expectedRows.length && dataRows.length === expectedRows.length && uniqueIds.size === expectedRows.length;
    return { passed: exact, detail: `${matched}/${expectedRows.length} canonical ${name} rows preserve the exact header-bound row set.` };
  }
  return { passed: false, detail: `No header-bound ${name} source table found.` };
}
function independentHistoricals(): Record<string, number> {
  const result: Record<string, number> = {}; const invoiceRows = canonicalRows("invoices"); const paymentRows = canonicalRows("payments"); const payrollRows = canonicalRows("payroll"); const expenseRows = canonicalRows("expenses"); const cashRows = canonicalRows("cash"); const subscriptionRows = canonicalRows("subscriptions");
  for (const month of ACTUAL_MONTHS) {
    result[`actual_revenue_${month}`] = invoiceRows.filter((row) => row[2] === month).reduce((sum, row) => sum + money(row[3]!) + money(row[5]!), 0);
    result[`actual_collections_${month}`] = paymentRows.filter((row) => row[4]?.toLowerCase() === "settled" && row[2]!.slice(0, 7) === month).reduce((sum, row) => sum + money(row[3]!), 0);
    result[`actual_payroll_${month}`] = payrollRows.filter((row) => row[3] === month).reduce((sum, row) => sum + money(row[4]!) + money(row[5]!), 0);
    result[`actual_opex_${month}`] = expenseRows.filter((row) => row[1] === month).reduce((sum, row) => sum + money(row[4]!), 0);
    result[`ending_cash_${month}`] = cashRows.filter((row) => row[5]?.toLowerCase() === "posted" && row[1]!.slice(0, 7) <= month).reduce((sum, row) => sum + money(row[3]!), 0);
    const end = new Date(`${month}-01T00:00:00Z`); end.setUTCMonth(end.getUTCMonth() + 1, 0); const previous = new Date(`${month}-01T00:00:00Z`); previous.setUTCDate(0);
    const byCustomer = (date: Date) => { const values = new Map<string, number>(); for (const row of subscriptionRows.filter((candidate) => new Date(`${candidate[3]!.replaceAll("/", "-")}T00:00:00Z`) <= date && (!candidate[4] || new Date(`${candidate[4]}T00:00:00Z`) >= date))) values.set(row[1]!, (values.get(row[1]!) ?? 0) + money(row[6]!)); return values; };
    const opening = byCustomer(previous); const ending = byCustomer(end); const openingMrr = [...opening.values()].reduce((sum, value) => sum + value, 0);
    result[`ending_mrr_${month}`] = [...ending.values()].reduce((sum, value) => sum + value, 0);
    result[`logo_churn_${month}`] = [...opening.keys()].filter((customer) => !ending.has(customer)).length;
    let churnAndContraction = 0; let expansion = 0;
    for (const [customer, openingAmount] of opening) { const endingAmount = ending.get(customer) ?? 0; churnAndContraction += Math.max(openingAmount - endingAmount, 0); expansion += Math.max(endingAmount - openingAmount, 0); }
    result[`gross_revenue_churn_${month}`] = openingMrr === 0 ? 0 : churnAndContraction / openingMrr;
    result[`nrr_${month}`] = openingMrr === 0 ? 1 : (openingMrr - churnAndContraction + expansion) / openingMrr;
  } return result;
}
function numericAdjacent(cell: WorkbookCellSnapshot | undefined): number | null { return typeof cell?.value === "number" && Number.isFinite(cell.value) ? cell.value : null; }
function approximately(actual: unknown, expected: number): boolean { return typeof actual === "number" && Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(0.01, Math.abs(expected) * 1e-8); }
async function validateRuntime(runtime: SpreadsheetRuntimePaths, expectedDigest?: string, expectedNodeDigest?: string): Promise<void> {
  if (!runtime.nodeExecutable.startsWith("/") || !runtime.nodeModulesDirectory.startsWith("/")) throw new Error("Spreadsheet runtime paths must be explicit absolute paths.");
  await access(runtime.nodeExecutable);
  const metadata = JSON.parse(await readFile(join(runtime.nodeModulesDirectory, "@oai/artifact-tool/package.json"), "utf8"));
  if (metadata.version !== "2.8.59") throw new Error(`Spreadsheet runtime requires @oai/artifact-tool 2.8.59, received ${String(metadata.version)}.`);
  await assertSpreadsheetRuntime(runtime, expectedDigest, expectedNodeDigest);
}
async function expectMissing(path: string): Promise<void> { if (await access(path).then(() => true, () => false)) throw new Error(`Workspace already exists: ${path}`); }
async function required(run: Parameters<typeof materializeSaasOperatingModelFixture>[0]["runCommand"], command: string, args: readonly string[], cwd: string, env?: Readonly<Record<string, string>>) { const result = await run(command, args, { cwd, ...(env ? { env } : {}) }); if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.exitCode}): ${result.stderr || result.stdout}`); return result; }
