import { execFile } from "node:child_process";
import { access, chmod, mkdir, mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  gradeSaasOperatingModelWorkspace,
  materializeSaasOperatingModelFixture,
  SAAS_OPERATING_MODEL_CASE_ID,
  SAAS_OPERATING_MODEL_VERIFIER_SOURCE_SHA256,
  SAAS_SOURCE_FILES,
  SPREADSHEET_ARTIFACT_INSPECTOR_SOURCE_SHA256,
  SPREADSHEET_NODE_CONTENT_DIGEST,
  saasOperatingModelCase,
  type WorkbookInspection,
  type WorkbookInspector,
  spreadsheetRuntimeContentDigest,
  preflightSpreadsheetRuntime,
} from "../src/index.js";

const execFileAsync = promisify(execFile);
const runCommand = async (command: string, args: readonly string[], { cwd, env }: { cwd: string; env?: Readonly<Record<string, string>> }) => {
  try { const result = await execFileAsync(command, args, { cwd, env: { ...process.env, ...env } }); return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }; }
  catch (error) { const value = error as { code?: number; stdout?: string; stderr?: string }; return { exitCode: value.code ?? 1, stdout: value.stdout ?? "", stderr: value.stderr ?? String(error) }; }
};

async function fakeRuntime(root: string) {
  const nodeModulesDirectory = join(root, "runtime", "node_modules");
  await mkdir(join(nodeModulesDirectory, "@oai", "artifact-tool"), { recursive: true });
  await writeFile(join(nodeModulesDirectory, "@oai", "artifact-tool", "package.json"), JSON.stringify({ name: "@oai/artifact-tool", version: "2.8.59" }));
  await mkdir(join(nodeModulesDirectory, "@oai", "artifact-tool", "dist"), { recursive: true });
  await writeFile(join(nodeModulesDirectory, "@oai", "artifact-tool", "dist", "artifact_tool.mjs"), "// fixture entrypoint\n");
  const nodeExecutable = join(root, "runtime", "node"); await writeFile(nodeExecutable, "node");
  return { nodeModulesDirectory, nodeExecutable, contentDigest: await spreadsheetRuntimeContentDigest(join(nodeModulesDirectory, "@oai", "artifact-tool")), nodeDigest: `sha256:${createHash("sha256").update(await readFile(nodeExecutable)).digest("hex")}` };
}
const runtimeRun = (runtime: { nodeExecutable: string }) => async (command: string, args: readonly string[], options: { cwd: string; env?: Readonly<Record<string, string>> }) => (
  command === runtime.nodeExecutable ? { exitCode: 0, stdout: "v24.19.0\n", stderr: "" } : runCommand(command, args, options)
);

describe("SaaS operating model case", () => {
  it.skipIf(process.platform === "win32")("authenticates candidate runtime bytes before invoking Node", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-spreadsheet-untrusted-runtime-"));
    const nodeExecutable = join(root, "node");
    const nodeModulesPath = join(root, "node_modules");
    const packageDirectory = join(nodeModulesPath, "@oai", "artifact-tool");
    const marker = join(root, "executed");
    await mkdir(join(packageDirectory, "dist"), { recursive: true });
    await writeFile(nodeExecutable, `#!/bin/sh\nprintf unsafe > "${marker}"\nprintf 'v24.19.0\\n'\n`);
    await chmod(nodeExecutable, 0o755);
    await writeFile(join(packageDirectory, "package.json"), JSON.stringify({ name: "@oai/artifact-tool", version: "2.8.59" }));
    await writeFile(join(packageDirectory, "dist", "artifact_tool.mjs"), "// untrusted package entrypoint\n");

    const result = await preflightSpreadsheetRuntime({
      nodeExecutable,
      nodeModulesPath,
      environmentDigest: `sha256:${"0".repeat(64)}`,
      nodeVersion: "24.19.0",
      artifactToolVersion: "2.8.59",
      nodeExecutableDigest: SPREADSHEET_NODE_CONTENT_DIGEST,
      artifactToolEntrypointDigest: `sha256:${"0".repeat(64)}`,
      artifactToolContentDigest: `sha256:${"0".repeat(64)}`,
    });
    expect(result).toMatchObject({ available: false, reason: expect.stringContaining("does not match the sealed environment contract") });
    await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a linked package dependency before invoking Node", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-spreadsheet-linked-runtime-"));
    const fixture = await fakeRuntime(root);
    const packageDirectory = join(fixture.nodeModulesDirectory, "@oai", "artifact-tool");
    const linkedFile = join(root, "outside.mjs");
    await writeFile(linkedFile, "// package escape\n");
    await symlink(linkedFile, join(packageDirectory, "escape.mjs"));
    const result = await preflightSpreadsheetRuntime({
      nodeExecutable: fixture.nodeExecutable,
      nodeModulesPath: fixture.nodeModulesDirectory,
      environmentDigest: `sha256:${"0".repeat(64)}`,
      nodeVersion: "24.19.0",
      artifactToolVersion: "2.8.59",
      nodeExecutableDigest: fixture.nodeDigest as `sha256:${string}`,
      artifactToolEntrypointDigest: `sha256:${"0".repeat(64)}`,
      artifactToolContentDigest: fixture.contentDigest as `sha256:${string}`,
    });
    expect(result).toMatchObject({ available: false, reason: expect.stringContaining("could not be verified") });
  });

  it("binds normalized verifier and inspector source bytes", async () => {
    const verifier = (await readFile(new URL("../src/project-cases/saas-operating-model.ts", import.meta.url), "utf8")).replace(
      /export const SAAS_OPERATING_MODEL_VERIFIER_SOURCE_SHA256 = "[^"]+";/,
      'export const SAAS_OPERATING_MODEL_VERIFIER_SOURCE_SHA256 = "<normalized>";',
    );
    const inspector = (await readFile(new URL("../src/project-cases/spreadsheet-artifact-inspector.ts", import.meta.url), "utf8")).replace(
      /export const SPREADSHEET_ARTIFACT_INSPECTOR_SOURCE_SHA256 = "[^"]+";/,
      'export const SPREADSHEET_ARTIFACT_INSPECTOR_SOURCE_SHA256 = "<normalized>";',
    );
    expect(createHash("sha256").update(verifier).digest("hex")).toBe(SAAS_OPERATING_MODEL_VERIFIER_SOURCE_SHA256);
    expect(createHash("sha256").update(inspector).digest("hex")).toBe(SPREADSHEET_ARTIFACT_INSPECTOR_SOURCE_SHA256);
  });

  it("publishes a sealed candidate snapshot without evaluator paths", () => {
    expect(saasOperatingModelCase.definition.id).toBe(SAAS_OPERATING_MODEL_CASE_ID);
    expect(saasOperatingModelCase.snapshot.authoringStatus).toBe("candidate");
    expect(saasOperatingModelCase.definition.threads[0]?.permissionProfileId).toBe("full");
    expect(JSON.stringify(saasOperatingModelCase.catalogSnapshot)).not.toContain("sealedPath");
    expect(saasOperatingModelCase.snapshotDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("materializes identical clean immutable fixtures and leaves the untouched baseline red", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-saas-fixture-test-")); const runtime = await fakeRuntime(root);
    const first = await materializeSaasOperatingModelFixture({ workspaceDirectory: join(root, "first"), runtime, expectedRuntimeDigest: runtime.contentDigest, expectedNodeDigest: runtime.nodeDigest, runCommand: runtimeRun(runtime), platform: "darwin" });
    const second = await materializeSaasOperatingModelFixture({ workspaceDirectory: join(root, "second"), runtime, expectedRuntimeDigest: runtime.contentDigest, expectedNodeDigest: runtime.nodeDigest, runCommand: runtimeRun(runtime), platform: "darwin" });
    expect(first.seededTree).toBe(second.seededTree);
    expect(first.sourceRevision).toBe(saasOperatingModelCase.snapshot.artifacts.workspace.revision);
    const inspector: WorkbookInspector = { inspect: async () => { throw new Error("must not inspect missing workbook"); }, mutateAndInspect: async () => { throw new Error("must not mutate missing workbook"); } };
    const checks = await gradeSaasOperatingModelWorkspace({ workspaceDirectory: first.workspaceDirectory, baseRevision: first.seededCommit, inspector, runCommand });
    expect(checks.find((check) => check.name === "workspace:required-delivery-files")?.passed).toBe(false);
    expect(checks.find((check) => check.name === "workspace:formula-lineage:required-outputs")?.passed).toBe(false);
    expect(checks.find((check) => check.name === "workspace:changed-input-response:invoice")?.passed).toBe(false);
  });

  it("records independent predicates so formula and source mutants fail only their relevant gates", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-saas-grade-test-")); const runtime = await fakeRuntime(root);
    const fixture = await materializeSaasOperatingModelFixture({ workspaceDirectory: join(root, "workspace"), runtime, expectedRuntimeDigest: runtime.contentDigest, expectedNodeDigest: runtime.nodeDigest, runCommand: runtimeRun(runtime), platform: "darwin" });
    await mkdir(join(fixture.workspaceDirectory, "deliverables")); await writeFile(join(fixture.workspaceDirectory, "deliverables", "saas-operating-model.xlsx"), "fixture");
    await runCommand("git", ["add", "deliverables/saas-operating-model.xlsx"], { cwd: fixture.workspaceDirectory });
    await runCommand("git", ["commit", "-m", "Build model"], { cwd: fixture.workspaceDirectory });
    const good = inspection();
    const hardcoded = structuredClone(good); const dashboardKey = hardcoded.sheets.flatMap((sheet) => sheet.cells).find((cell) => cell.value === "dashboard_ltm_revenue")!;
    (hardcoded.sheets.flatMap((sheet) => sheet.cells).find((cell) => cell.sheet === dashboardKey.sheet && cell.row === dashboardKey.row && cell.column === dashboardKey.column + 1)! as unknown as { formula: string }).formula = "";
    const omitted = structuredClone(good); const payment = omitted.sheets.flatMap((sheet) => sheet.cells).find((cell) => cell.value === "PAY-001")!;
    (omitted.sheets.find((sheet) => sheet.name === payment.sheet)!.cells as unknown as { value: unknown }[]).splice(omitted.sheets.find((sheet) => sheet.name === payment.sheet)!.cells.indexOf(payment), 1);
    const grade = (snapshot: WorkbookInspection) => gradeSaasOperatingModelWorkspace({ workspaceDirectory: fixture.workspaceDirectory, baseRevision: fixture.seededCommit, inspector: inspector(snapshot), runCommand });
    const hardcodedChecks = await grade(hardcoded); const omittedChecks = await grade(omitted);
    expect(hardcodedChecks.find((check) => check.name.endsWith("formula-lineage:required-outputs"))?.passed).toBe(false);
    expect(hardcodedChecks.find((check) => check.name.endsWith("source-coverage:payments-rows"))?.passed).toBe(true);
    expect(omittedChecks.find((check) => check.name.endsWith("source-coverage:payments-rows"))?.passed).toBe(false);
    expect(omittedChecks.find((check) => check.name.endsWith("formula-lineage:required-outputs"))?.passed).toBe(true);
  });
});

function inspector(snapshot: WorkbookInspection = inspection()): WorkbookInspector {
  return { inspect: async () => snapshot, mutateAndInspect: async () => mutate(snapshot) };
}
function inspection(): WorkbookInspection {
  const cells: { value: unknown; formula: string; sheet: string; row: number; column: number }[] = []; const sourceSheets = [];
  for (const [path, text] of Object.entries(SAAS_SOURCE_FILES)) {
    const name = `Source_${path.split("/").pop()!.replace(".csv", "")}`; const sourceCells: typeof cells = []; const lines = text.trim().split(/\r?\n/); const headers = parseLine(lines[0]!);
    for (const [column, value] of headers.entries()) sourceCells.push({ value, formula: "", sheet: name, row: 0, column });
    const parsed = lines.slice(1).map(parseLine); const latest = new Map(parsed.map((values) => [values[0]!.trim(), values.map((value) => value.trim())])); let sourceRow = 1;
    for (const values of latest.values()) { for (const [column, value] of values.entries()) if (value !== "") sourceCells.push({ value, formula: "", sheet: name, row: sourceRow, column }); sourceRow += 1; }
    cells.push(...sourceCells); sourceSheets.push({ name, cells: sourceCells, renderBytes: 10_000, drawingCount: 0 });
  }
  let row = 0;
  const actual = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, "0")}`);
  const forecast = Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
  const keys = [...actual.flatMap((month) => [`actual_revenue_${month}`, `actual_collections_${month}`, `ending_mrr_${month}`, `logo_churn_${month}`, `gross_revenue_churn_${month}`, `nrr_${month}`, `actual_payroll_${month}`, `actual_opex_${month}`, `ending_cash_${month}`]), ...["base", "upside", "downside"].flatMap((scenario) => forecast.flatMap((month) => [`scenario_${scenario}_revenue_${month}`, `scenario_${scenario}_ending_cash_${month}`])), ...["base", "upside", "downside"].map((scenario) => `scenario_${scenario}_runway_months`), "dashboard_ltm_revenue", "dashboard_base_ending_cash", "model_status", "check_source_coverage", "check_cash_rollforward", "check_scenario_validity"];
  for (const key of keys) { const isText = key.includes("runway_months") || key.includes("status") || key.startsWith("check_"); cells.push({ value: key, formula: "", sheet: "Model", row, column: 0 }, { value: isText ? (key.includes("runway") ? "12+ months" : "PASS") : key === "actual_revenue_2025-06" ? 4_000 : 1, formula: "=B1", sheet: "Model", row, column: 1 }); row += 1; }
  return { sheets: [...sourceSheets, { name: "Model", cells: cells.filter((cell) => cell.sheet === "Model"), renderBytes: 10_000, drawingCount: 0 }, { name: "Dashboard", cells: [], renderBytes: 10_000, drawingCount: 1, chartSeriesFormulaCount: 3 }] };
}
function parseLine(line: string): string[] { const values: string[] = []; let value = ""; let quoted = false; for (const character of line) { if (character === '"') quoted = !quoted; else if (character === "," && !quoted) { values.push(value); value = ""; } else value += character; } values.push(value); return values; }
function mutate(snapshot: WorkbookInspection): WorkbookInspection {
  const result = structuredClone(snapshot); const cells = result.sheets.flatMap((sheet) => sheet.cells); const label = cells.find((cell) => cell.value === "actual_revenue_2025-06")!; const value = cells.find((cell) => cell.sheet === label.sheet && cell.row === label.row && cell.column === label.column + 1)!; (value as { value: number }).value += 1_000; return result;
}
