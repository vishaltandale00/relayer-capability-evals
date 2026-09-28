import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { checksMatchExpectedOutcome, digestDirectory, prepareEmptyOutputRoot } from "../../spreadsheet-admission-outcome.mjs";

const expected = {
  nodeVersion: "v24.19.0",
  nodeDigest: "sha256:27db838bb204ef7c21df2931f5656e4c8fb32e6e947f363a402b49714d32b5b1",
  artifactToolVersion: "2.8.59",
  artifactToolContentDigest: "sha256:eb3c0b54042c490c79837b4cd093028f34f2199e22236977ddbba6ec0482924c",
  artifactToolEntrypointDigest: "sha256:d23c29992898aaf6efc0f78611ee34ba213579fa25e05ad4dc5dbcb356c11a89",
};
const nodeExecutable = process.env.RELAYER_SPREADSHEET_NODE;
const nodeModulesDirectory = process.env.RELAYER_SPREADSHEET_NODE_MODULES;
if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error(`Spreadsheet admission requires darwin-arm64; found ${process.platform}-${process.arch}.`);
if (!nodeExecutable || !nodeModulesDirectory || !path.isAbsolute(nodeExecutable) || !path.isAbsolute(nodeModulesDirectory)) {
  throw new Error("Set RELAYER_SPREADSHEET_NODE and RELAYER_SPREADSHEET_NODE_MODULES to explicit absolute paths.");
}
const exec = promisify(execFile);
const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const repositoryRoot = path.resolve(new URL("../../..", import.meta.url).pathname);
const { ArtifactToolWorkbookInspector, gradeSaasOperatingModelWorkspace, materializeSaasOperatingModelFixture, saasOperatingModelCase } = await import("../../../packages/capability-evals/dist/index.js");
const runtimeConfig = {
  nodeExecutable,
  nodeModulesPath: nodeModulesDirectory,
  environmentDigest: saasOperatingModelCase.snapshot.artifacts.workspace.environmentDigest,
  nodeVersion: expected.nodeVersion.replace(/^v/, ""),
  artifactToolVersion: expected.artifactToolVersion,
  nodeExecutableDigest: expected.nodeDigest,
  artifactToolEntrypointDigest: expected.artifactToolEntrypointDigest,
  artifactToolContentDigest: expected.artifactToolContentDigest,
};
const runId = new Date().toISOString().replaceAll(/[^0-9TZ-]/g, "-");
const configuredOutputRoot = process.env.RELAYER_SPREADSHEET_ADMISSION_ROOT;
const outputDirectory = configuredOutputRoot
  ? await prepareEmptyOutputRoot(configuredOutputRoot)
  : await prepareEmptyOutputRoot(fileURLToPath(new URL(`./evidence-node24.19.0-artifact-tool-2.8.59/${runId}/`, import.meta.url)));
const root = outputDirectory;
const sourceFiles = ["./create-workbooks.mjs", "./run-admission.mjs", "../../spreadsheet-admission-outcome.mjs", "../../../packages/capability-evals/src/project-cases/saas-operating-model.ts", "../../../packages/capability-evals/src/project-cases/spreadsheet-artifact-inspector.ts"];
async function captureSourceDigests() {
  const files = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, digest(await fs.readFile(new URL(file, import.meta.url)))])));
  return { ...files, "packages/capability-evals/dist": await digestDirectory(path.resolve(new URL("../../../packages/capability-evals/dist", import.meta.url).pathname)) };
}
const sourceDigestsBefore = await captureSourceDigests();
const { preflightSpreadsheetRuntime } = await import("../../../packages/capability-evals/dist/index.js");
const runtimePreflight = await preflightSpreadsheetRuntime(runtimeConfig);
if (!runtimePreflight.available) {
  const sourceDigestsAfter = await captureSourceDigests();
  const receipt = { schemaVersion: 1, runId, status: "runtime-preflight-failed", runtimePreflight, sourceDigestsBefore, sourceDigestsAfter, inputsStable: JSON.stringify(sourceDigestsBefore) === JSON.stringify(sourceDigestsAfter) };
  await fs.writeFile(path.join(root, "admission-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify(receipt, null, 2));
  process.exit(1);
}
const actual = { nodeDigest: expected.nodeDigest, artifactToolVersion: expected.artifactToolVersion, artifactToolContentDigest: expected.artifactToolContentDigest, artifactToolEntrypointDigest: expected.artifactToolEntrypointDigest };
const runtime = { nodeExecutable, nodeModulesDirectory };
const commandLog = [];
const runCommand = async (command, args, { cwd, env }) => {
  try {
    const value = await exec(command, args, { cwd, env: { ...process.env, ...env } });
    commandLog.push({ command, args, cwd, exitCode: 0, stdout: value.stdout, stderr: value.stderr });
    return { exitCode: 0, stdout: value.stdout, stderr: value.stderr };
  } catch (error) {
    const result = { exitCode: error.code || 1, stdout: error.stdout || "", stderr: error.stderr || String(error) };
    commandLog.push({ command, args, cwd, ...result });
    return result;
  }
};
const inspector = new ArtifactToolWorkbookInspector(runtime);
const expectedCheckNames = new Set([
  ...["subscriptions", "invoices", "payments", "payroll", "expenses", "cash"].flatMap((name) => [`workspace:source-coverage:${name}`, `workspace:source-coverage:${name}-rows`]),
  "workspace:historical-reconciliation:keys", "workspace:historical-reconciliation:independent-values",
  "workspace:forecast-scenarios:keys", "workspace:forecast-scenarios:materially-different", "workspace:forecast-scenarios:distinct-drivers", "workspace:forecast-scenarios:independent-values",
  "workspace:cash-runway:keys", "workspace:cash-runway:independent-values",
  "workspace:formula-lineage:required-outputs", "workspace:formula-lineage:unique-keys", "workspace:formula-lineage:cell-references",
  "workspace:formula-lineage:no-external-links", "workspace:formula-lineage:no-external-package-parts", "workspace:formula-lineage:no-dynamic-external-functions",
  "workspace:formula-lineage:no-formula-errors", "workspace:formula-lineage:dashboard-values", "workspace:formula-lineage:visible-checks",
  "workspace:workbook-rendering:all-sheets", "workspace:workbook-rendering:dashboard-chart", "workspace:workbook-rendering:dashboard-chart-series", "workspace:workbook-rendering:dashboard-chart-binding",
  "workspace:changed-input-response:invoice", "workspace:required-delivery-files", "workspace:delivery-commit", "workspace:delivery-clean",
]);
const baselineExpectedFailures = [
  ...["subscriptions", "invoices", "payments", "payroll", "expenses", "cash"].flatMap((name) => [`workspace:source-coverage:${name}`, `workspace:source-coverage:${name}-rows`]),
  "workspace:historical-reconciliation:keys", "workspace:historical-reconciliation:independent-values",
  "workspace:forecast-scenarios:keys", "workspace:forecast-scenarios:materially-different", "workspace:forecast-scenarios:distinct-drivers", "workspace:forecast-scenarios:independent-values",
  "workspace:cash-runway:keys",
  "workspace:formula-lineage:required-outputs", "workspace:formula-lineage:dashboard-values", "workspace:formula-lineage:visible-checks",
  "workspace:workbook-rendering:all-sheets", "workspace:workbook-rendering:dashboard-chart", "workspace:workbook-rendering:dashboard-chart-series", "workspace:workbook-rendering:dashboard-chart-binding",
  "workspace:changed-input-response:invoice", "workspace:required-delivery-files", "workspace:delivery-commit",
].sort();
const portfolio = [
  { id: "baseline", build: false, expect: "red", expectedFailures: baselineExpectedFailures, prerequisites: ["workspace:delivery-clean"] },
  { id: "green-a", build: true, variant: "a", mutant: "none", expect: "green", expectedFailures: [] },
  { id: "green-b", build: true, variant: "b", mutant: "none", expect: "green", expectedFailures: [] },
  { id: "mutant-hardcoded", build: true, variant: "a", mutant: "hardcoded", expect: "red", gate: "formula-lineage", expectedFailures: ["workspace:formula-lineage:required-outputs", "workspace:formula-lineage:dashboard-values"], prerequisites: ["workspace:workbook-rendering:all-sheets", "workspace:required-delivery-files", "workspace:delivery-commit", "workspace:delivery-clean"] },
  { id: "mutant-omitted-source", build: true, variant: "b", mutant: "omitted-source", expect: "red", gate: "source-coverage:payments", expectedFailures: ["workspace:source-coverage:payments", "workspace:source-coverage:payments-rows", "workspace:historical-reconciliation:independent-values", "workspace:formula-lineage:cell-references"], prerequisites: ["workspace:workbook-rendering:all-sheets", "workspace:required-delivery-files", "workspace:delivery-commit", "workspace:delivery-clean"] },
  { id: "mutant-same-scenarios", build: true, variant: "a", mutant: "same-scenarios", expect: "red", gate: "forecast-scenarios:materially-different", expectedFailures: ["workspace:forecast-scenarios:materially-different", "workspace:forecast-scenarios:independent-values"], prerequisites: ["workspace:workbook-rendering:all-sheets", "workspace:required-delivery-files", "workspace:delivery-commit", "workspace:delivery-clean"] },
];
const results = [];
for (const candidate of portfolio) {
  const workspaceDirectory = path.join(root, candidate.id);
  try {
  const fixture = await materializeSaasOperatingModelFixture({ workspaceDirectory, runtime, runCommand, platform: "darwin" });
  if (candidate.build) {
    const scriptDir = path.join(workspaceDirectory, ".relayerspreadsheet");
    await fs.mkdir(scriptDir, { recursive: true });
    const builderCopy = path.join(scriptDir, "create-workbooks.mjs");
    await fs.copyFile(new URL("./create-workbooks.mjs", import.meta.url), builderCopy);
    let built;
    try {
      built = await exec(nodeExecutable, [builderCopy, workspaceDirectory, candidate.variant, candidate.mutant], { cwd: workspaceDirectory });
      commandLog.push({ command: nodeExecutable, args: ["create-workbooks.mjs", candidate.variant, candidate.mutant], cwd: candidate.id, exitCode: 0, stdout: built.stdout, stderr: built.stderr });
    } catch (error) {
      commandLog.push({ command: nodeExecutable, args: ["create-workbooks.mjs", candidate.variant, candidate.mutant], cwd: candidate.id, exitCode: error.code || 1, stdout: error.stdout || "", stderr: error.stderr || String(error) });
      throw error;
    }
    await fs.rm(path.join(workspaceDirectory, "deliverables", "saas-operating-model.xlsx.inspect.ndjson"), { force: true });
    await runCommand("git", ["add", "deliverables/saas-operating-model.xlsx"], { cwd: workspaceDirectory });
    await runCommand("git", ["commit", "--quiet", "-m", `Admission ${candidate.id}`], { cwd: workspaceDirectory });
  }
  const checks = await gradeSaasOperatingModelWorkspace({ workspaceDirectory, baseRevision: fixture.seededCommit, inspector, runCommand });
  const expectedOutcome = checksMatchExpectedOutcome(checks, {
    expectedNames: [...expectedCheckNames],
    expectedFailures: candidate.expectedFailures,
    prerequisites: candidate.prerequisites ?? [],
  });
  const passed = expectedOutcome && candidate.expectedFailures.length === 0;
  const byName = new Map(checks.map((check) => [check.name, check]));
  const targetPrefix = candidate.gate ? `workspace:${candidate.gate}` : "";
  const targets = candidate.gate ? checks.filter(({ name }) => name === targetPrefix || name.startsWith(`${targetPrefix}:`) || name.startsWith(`${targetPrefix}-`)) : [];
  const admitted = expectedOutcome;
  const workbookPath = path.join(workspaceDirectory, "deliverables", "saas-operating-model.xlsx");
  const workbookDigest = candidate.build ? digest(await fs.readFile(workbookPath)) : null;
  const renderDigests = candidate.expect === "green" && passed
    ? (await inspector.inspect(workbookPath)).sheets.map((sheet) => ({ sheet: sheet.name, digest: sheet.renderDigest, bytes: sheet.renderBytes }))
    : [];
  results.push({ id: candidate.id, admitted, passed, workspace: candidate.id, workbookDigest, renderDigests,
    builderDigest: candidate.build ? digest(await fs.readFile(path.join(workspaceDirectory, ".relayerspreadsheet", "create-workbooks.mjs"))) : null,
    builderMatchesSource: candidate.build ? digest(await fs.readFile(path.join(workspaceDirectory, ".relayerspreadsheet", "create-workbooks.mjs"))) === sourceDigestsBefore["./create-workbooks.mjs"] : null,
    failedChecks: checks.filter((check) => !check.passed).map((check) => check.name),
    failedDetails: checks.filter((check) => !check.passed).map((check) => ({ name: check.name, detail: check.detail })),
    target: targets.find((check) => !check.passed)?.name ?? targets[0]?.name ?? null });
  await fs.writeFile(path.join(workspaceDirectory, "checks.json"), `${JSON.stringify(checks, null, 2)}\n`);
  await fs.writeFile(path.join(root, "commands.jsonl"), `${commandLog.map((item) => JSON.stringify(item)).join("\n")}\n`);
  await fs.writeFile(path.join(root, "progress.json"), `${JSON.stringify({ completed: results }, null, 2)}\n`);
  if (!admitted) break;
  } catch (error) {
    const failure = { id: candidate.id, admitted: false, error: { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null } };
    results.push(failure);
    await fs.mkdir(workspaceDirectory, { recursive: true });
    await fs.writeFile(path.join(workspaceDirectory, "error.json"), `${JSON.stringify(failure.error, null, 2)}\n`);
    await fs.writeFile(path.join(root, "commands.jsonl"), `${commandLog.map((item) => JSON.stringify(item)).join("\n")}\n`);
    await fs.writeFile(path.join(root, "progress.json"), `${JSON.stringify({ completed: results }, null, 2)}\n`);
    break;
  }
}
const sourceDigestsAfter = await captureSourceDigests();
const runtimePreflightAfter = await preflightSpreadsheetRuntime(runtimeConfig);
const inputsStable = JSON.stringify(sourceDigestsBefore) === JSON.stringify(sourceDigestsAfter) && runtimePreflightAfter.available;
const sourceDigests = sourceDigestsAfter;
const sourceDigest = digest(JSON.stringify(sourceDigestsBefore));
const output = { schemaVersion: 1, caseId: saasOperatingModelCase.definition.id,
  caseSnapshotDigest: saasOperatingModelCase.snapshotDigest,
  verifierDigest: saasOperatingModelCase.snapshot.artifacts.verifier.contentDigest,
  sourceDigest, sourceDigestsBefore, sourceDigestsAfter, runtimePreflightBefore: runtimePreflight, runtimePreflightAfter, inputsStable, sourceDigests, runId,
  runtime: { ...expected, runtimeTreeDigest: actual.artifactToolContentDigest, nodeDigest: actual.nodeDigest },
  review: { status: "non-certifying-no-pr", note: "Deterministic admission evidence; adversarial review is reported separately and invalidates on source change." }, results };
await fs.writeFile(path.join(root, "admission-receipt.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (results.length !== portfolio.length || results.some((result, index) => result.id !== portfolio[index]?.id || !result.admitted)) process.exitCode = 1;
if (!inputsStable) process.exitCode = 1;

function osTmpdir() { return process.env.TMPDIR || "/tmp"; }
