import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { checksMatchExpectedOutcome, digestDirectory, prepareEmptyOutputRoot } from "../../spreadsheet-admission-outcome.mjs";

const expected = {
  nodeVersion: "24.19.0",
  nodeExecutableDigest: "sha256:27db838bb204ef7c21df2931f5656e4c8fb32e6e947f363a402b49714d32b5b1",
  artifactToolVersion: "2.8.59",
  artifactToolEntrypointDigest: "sha256:d23c29992898aaf6efc0f78611ee34ba213579fa25e05ad4dc5dbcb356c11a89",
  artifactToolContentDigest: "sha256:eb3c0b54042c490c79837b4cd093028f34f2199e22236977ddbba6ec0482924c",
};
const nodeExecutable = process.env.RELAYER_SPREADSHEET_NODE;
const nodeModulesPath = process.env.RELAYER_SPREADSHEET_NODE_MODULES;
if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error(`Spreadsheet admission requires darwin-arm64; found ${process.platform}-${process.arch}.`);
if (!nodeExecutable || !nodeModulesPath || !path.isAbsolute(nodeExecutable) || !path.isAbsolute(nodeModulesPath)) {
  throw new Error("Set RELAYER_SPREADSHEET_NODE and RELAYER_SPREADSHEET_NODE_MODULES to explicit absolute paths.");
}
const exec = promisify(execFile);
const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const repositoryRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const builderSource = path.join(repositoryRoot, "packages/capability-evals/test/fixtures/production-delivery-planner-workbook.mjs");
const outputParent = path.dirname(fileURLToPath(import.meta.url));
const runId = new Date().toISOString().replaceAll(/[^0-9TZ-]/g, "-");
const outputDirectory = await prepareEmptyOutputRoot(process.env.RELAYER_SPREADSHEET_ADMISSION_ROOT
  ?? path.join(outputParent, `evidence-node24.19.0-artifact-tool-2.8.59-${runId}`));
const { PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST, gradeProductionDeliveryPlannerWorkspace,
  materializeProductionDeliveryPlannerFixture, preflightSpreadsheetRuntime, productionDeliveryPlannerCase } = await import("../../../packages/capability-evals/dist/index.js");
const runtime = {
  nodeExecutable,
  nodeModulesPath,
  environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  nodeVersion: expected.nodeVersion,
  artifactToolVersion: expected.artifactToolVersion,
  nodeExecutableDigest: expected.nodeExecutableDigest,
  artifactToolEntrypointDigest: expected.artifactToolEntrypointDigest,
  artifactToolContentDigest: expected.artifactToolContentDigest,
  timeoutMs: 120_000,
};
const sourceFiles = [
  "eval-cases/production-delivery-planner/admission/run-admission.mjs",
  "eval-cases/spreadsheet-admission-outcome.mjs",
  "packages/capability-evals/src/project-cases/production-delivery-planner.ts",
  "packages/capability-evals/src/project-cases/spreadsheet-runtime.ts",
  "packages/capability-evals/test/fixtures/production-delivery-planner-workbook.mjs",
];
async function captureSourceDigests() {
  const files = Object.fromEntries(await Promise.all(sourceFiles.map(async (relative) => [relative, digest(await fs.readFile(path.join(repositoryRoot, relative)))])));
  return { ...files, "packages/capability-evals/dist": await digestDirectory(path.join(repositoryRoot, "packages/capability-evals/dist")) };
}
const sourceDigestsBefore = await captureSourceDigests();
const runtimePreflight = await preflightSpreadsheetRuntime(runtime);
if (!runtimePreflight.available) {
  const sourceDigestsAfter = await captureSourceDigests();
  const failure = { schemaVersion: 1, runId, status: "runtime-preflight-failed", runtimePreflight, sourceDigestsBefore, sourceDigestsAfter, inputsStable: JSON.stringify(sourceDigestsBefore) === JSON.stringify(sourceDigestsAfter) };
  await fs.writeFile(path.join(outputDirectory, "admission-receipt.json"), `${JSON.stringify(failure, null, 2)}\n`);
  console.log(JSON.stringify(failure, null, 2));
  process.exit(1);
}
const actual = { nodeExecutableDigest: expected.nodeExecutableDigest, artifactToolVersion: expected.artifactToolVersion, artifactToolEntrypointDigest: expected.artifactToolEntrypointDigest, artifactToolContentDigest: expected.artifactToolContentDigest };
const nodeVersion = expected.nodeVersion;
// Each changed-input checkpoint reruns every semantic verifier predicate.
// Persistent model defects therefore fail all ten probes. Removing the
// required dashboard also removes a required semantic summary, so it fails
// cross-sheet reconciliation as well as rendering and all ten probes.
const allChangedProbeFailures = [
  "workspace:changed-input-order-quantity", "workspace:changed-input-order-quantity-boundary-2",
  "workspace:changed-input-capacity-hours", "workspace:changed-input-capacity-hours-boundary-2",
  "workspace:changed-input-supplier-lead-time", "workspace:changed-input-supplier-lead-time-boundary-2",
  "workspace:changed-scenario-demand-multiplier", "workspace:changed-scenario-capacity-multiplier",
  "workspace:changed-scenario-supplier-lead-time-adjustment", "workspace:changed-scenario-expedite-enabled",
];
const variants = [
  { id: "baseline", expected: "red", expectedFailures: ["workspace:workbook-parse", ...["source-coverage", "workbook-horizon", "scenario-controls", "formula-lineage", "complete-order-coverage", "order-conservation", "component-dependencies", "finished-goods-conservation", "weekly-capacity", "purchase-lead-times", "fulfillment-dates", "infeasible-exceptions", "cost-arithmetic", "cross-sheet-consistency"].map((name) => `workspace:${name}`), "workspace:workbook-rendering", "workspace:changed-input-order-quantity", "workspace:changed-input-order-quantity-boundary-2", "workspace:changed-input-capacity-hours", "workspace:changed-input-capacity-hours-boundary-2", "workspace:changed-input-supplier-lead-time", "workspace:changed-input-supplier-lead-time-boundary-2", "workspace:changed-scenario-demand-multiplier", "workspace:changed-scenario-capacity-multiplier", "workspace:changed-scenario-supplier-lead-time-adjustment", "workspace:changed-scenario-expedite-enabled", "workspace:required-workbook", "workspace:delivery-commit"] },
  { id: "green-primary", expected: "green", expectedFailures: [], variant: "green-primary" },
  { id: "green-alternate", expected: "green", expectedFailures: [], variant: "green-alternate" },
  { id: "mutant-hardcoded", expected: "red", expectedFailures: ["workspace:formula-lineage", ...allChangedProbeFailures], variant: "mutant-hardcoded", gate: "workspace:changed-input-order-quantity" },
  { id: "mutant-capacity", expected: "red", expectedFailures: ["workspace:source-coverage", "workspace:weekly-capacity", ...allChangedProbeFailures], variant: "mutant-capacity", gate: "workspace:weekly-capacity" },
  { id: "mutant-components", expected: "red", expectedFailures: ["workspace:component-dependencies", ...allChangedProbeFailures], variant: "mutant-components", gate: "workspace:component-dependencies" },
  { id: "mutant-inventory", expected: "red", expectedFailures: ["workspace:component-dependencies", ...allChangedProbeFailures], variant: "mutant-inventory", gate: "workspace:component-dependencies" },
  { id: "mutant-missing-order", expected: "red", expectedFailures: ["workspace:complete-order-coverage", "workspace:order-conservation", "workspace:infeasible-exceptions", ...allChangedProbeFailures], variant: "mutant-missing-order", gate: "workspace:complete-order-coverage" },
  { id: "mutant-late-delivery", expected: "red", expectedFailures: ["workspace:fulfillment-dates", ...allChangedProbeFailures], variant: "mutant-late-delivery", gate: "workspace:fulfillment-dates" },
  { id: "mutant-receipt", expected: "red", expectedFailures: ["workspace:purchase-lead-times", ...allChangedProbeFailures], variant: "mutant-receipt", gate: "workspace:purchase-lead-times" },
  { id: "mutant-cost", expected: "red", expectedFailures: ["workspace:cost-arithmetic", ...allChangedProbeFailures], variant: "mutant-cost", gate: "workspace:cost-arithmetic" },
  { id: "mutant-stale-dashboard", expected: "red", expectedFailures: ["workspace:cross-sheet-consistency", ...allChangedProbeFailures], variant: "mutant-stale-dashboard", gate: "workspace:cross-sheet-consistency" },
  { id: "mutant-dashboard", expected: "red", expectedFailures: ["workspace:workbook-rendering", "workspace:cross-sheet-consistency", ...allChangedProbeFailures], variant: "mutant-dashboard", gate: "workspace:workbook-rendering" },
];
const expectedCheckNames = new Set([
  "workspace:runtime-identity", "workspace:workbook-parse", "workspace:workbook-rendering",
  ...["source-coverage", "workbook-horizon", "scenario-controls", "formula-lineage", "complete-order-coverage", "order-conservation", "component-dependencies", "finished-goods-conservation", "weekly-capacity", "purchase-lead-times", "fulfillment-dates", "infeasible-exceptions", "cost-arithmetic", "cross-sheet-consistency"].map((name) => `workspace:${name}`),
  "workspace:changed-input-order-quantity", "workspace:changed-input-order-quantity-boundary-2",
  "workspace:changed-input-capacity-hours", "workspace:changed-input-capacity-hours-boundary-2",
  "workspace:changed-input-supplier-lead-time", "workspace:changed-input-supplier-lead-time-boundary-2",
  "workspace:changed-scenario-demand-multiplier", "workspace:changed-scenario-capacity-multiplier",
  "workspace:changed-scenario-supplier-lead-time-adjustment", "workspace:changed-scenario-expedite-enabled",
  "workspace:required-workbook", "workspace:delivery-commit", "workspace:delivery-clean",
]);
const prerequisitesFor = (candidate) => candidate.expected === "green"
  ? []
  : candidate.id === "baseline"
    ? ["workspace:runtime-identity", "workspace:delivery-clean"]
    : ["workspace:runtime-identity", "workspace:workbook-parse", "workspace:required-workbook", "workspace:delivery-commit", "workspace:delivery-clean", ...(candidate.gate === "workspace:workbook-rendering" ? [] : ["workspace:workbook-rendering"])];
const commandLog = [];
const runCommand = async (command, args, { cwd, env }) => {
  try {
    const result = await exec(command, args, { cwd, env: { ...process.env, ...env } });
    commandLog.push({ command, args, cwd, exitCode: 0, stdout: result.stdout, stderr: result.stderr });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const result = { exitCode: error.code || 1, stdout: error.stdout || "", stderr: error.stderr || String(error) };
    commandLog.push({ command, args, cwd, ...result });
    return result;
  }
};

const results = [];
for (const candidate of variants) {
  const workspaceDirectory = path.join(outputDirectory, candidate.id, "workspace");
  try {
  const fixture = await materializeProductionDeliveryPlannerFixture({ workspaceDirectory, platform: "darwin" });
  let baseRevision = fixture.seededCommit;
  let workbookDigest = null;
  let copiedBuilderDigest = null;
  if (candidate.variant) {
    const runtimeDirectory = path.join(outputDirectory, candidate.id, "artifact-runtime");
    await fs.mkdir(runtimeDirectory, { recursive: true });
    await fs.copyFile(builderSource, path.join(runtimeDirectory, "builder.mjs"));
    copiedBuilderDigest = digest(await fs.readFile(path.join(runtimeDirectory, "builder.mjs")));
    await fs.symlink(nodeModulesPath, path.join(runtimeDirectory, "node_modules"), "dir");
    const outputPath = path.join(workspaceDirectory, "production-delivery-plan.xlsx");
    let result;
    try {
      result = await exec(nodeExecutable, [path.join(runtimeDirectory, "builder.mjs"), outputPath, candidate.variant], {
        cwd: runtimeDirectory,
        env: { TMPDIR: runtimeDirectory, TZ: "UTC", LANG: "C", LC_ALL: "C", PATH: path.dirname(nodeExecutable) },
        timeout: 120_000,
        maxBuffer: 8 * 1024 * 1024,
      });
      commandLog.push({ command: nodeExecutable, args: ["builder.mjs", candidate.variant], cwd: candidate.id, exitCode: 0, stdout: result.stdout, stderr: result.stderr });
    } catch (error) {
      commandLog.push({ command: nodeExecutable, args: ["builder.mjs", candidate.variant], cwd: candidate.id, exitCode: error.code || 1, stdout: error.stdout || "", stderr: error.stderr || String(error) });
      throw error;
    }
    await fs.rm(`${outputPath}.inspect.ndjson`, { force: true });
    const run = async (command, args, env = {}) => runCommand(command, args, { cwd: workspaceDirectory, env });
    await required(run, "git", ["add", "--", "production-delivery-plan.xlsx"]);
    await required(run, "git", ["-c", "user.name=Relayer Eval Candidate", "-c", "user.email=eval-candidate@relayer.local", "-c", "commit.gpgsign=false", "commit", "--quiet", "-m", `Deliver planner workbook (${candidate.variant})`]);
    const head = await run("git", ["rev-parse", "HEAD"]);
    if (head.exitCode !== 0) throw new Error(`git rev-parse failed: ${head.stderr}`);
    baseRevision = fixture.seededCommit;
    workbookDigest = digest(await fs.readFile(outputPath));
  }
  const checks = await gradeProductionDeliveryPlannerWorkspace({ workspaceDirectory, runtime, baseRevision });
  const byName = new Map(checks.map((check) => [check.name, check]));
  const failedChecks = checks.filter((check) => !check.passed);
  const target = candidate.gate ? byName.get(candidate.gate) : undefined;
  const expectedOutcome = checksMatchExpectedOutcome(checks, {
    expectedNames: [...expectedCheckNames],
    expectedFailures: candidate.expectedFailures,
    prerequisites: prerequisitesFor(candidate),
  });
  const passed = expectedOutcome && candidate.expectedFailures.length === 0;
  const admitted = expectedOutcome && (!candidate.gate || target?.passed === false);
  results.push({ id: candidate.id, expected: candidate.expected, admitted, passed, workbookDigest, copiedBuilderDigest,
    builderMatchesSource: candidate.variant ? copiedBuilderDigest === sourceDigestsBefore["packages/capability-evals/test/fixtures/production-delivery-planner-workbook.mjs"] : null,
    failedChecks: failedChecks.map(({ name, detail }) => ({ name, detail })), target: target?.name ?? null });
  await fs.writeFile(path.join(path.dirname(workspaceDirectory), "checks.json"), `${JSON.stringify(checks, null, 2)}\n`);
  await fs.writeFile(path.join(outputDirectory, "commands.jsonl"), `${commandLog.map((item) => JSON.stringify(item)).join("\n")}\n`);
  await fs.writeFile(path.join(outputDirectory, "progress.json"), `${JSON.stringify({ completed: results }, null, 2)}\n`);
  if (!admitted) break;
  } catch (error) {
    const failure = { id: candidate.id, expected: candidate.expected, admitted: false, error: { message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : null } };
    results.push(failure);
    await fs.mkdir(path.dirname(workspaceDirectory), { recursive: true });
    await fs.writeFile(path.join(path.dirname(workspaceDirectory), "error.json"), `${JSON.stringify(failure.error, null, 2)}\n`);
    await fs.writeFile(path.join(outputDirectory, "commands.jsonl"), `${commandLog.map((item) => JSON.stringify(item)).join("\n")}\n`);
    await fs.writeFile(path.join(outputDirectory, "progress.json"), `${JSON.stringify({ completed: results }, null, 2)}\n`);
    break;
  }
}

const sourceDigestsAfter = await captureSourceDigests();
const runtimePreflightAfter = await preflightSpreadsheetRuntime(runtime);
const inputsStable = JSON.stringify(sourceDigestsBefore) === JSON.stringify(sourceDigestsAfter) && runtimePreflightAfter.available;
const sourceDigests = sourceDigestsAfter;
const receipt = {
  schemaVersion: 1,
  caseId: productionDeliveryPlannerCase.definition.id,
  caseSnapshotDigest: productionDeliveryPlannerCase.snapshotDigest,
  fixtureContentDigest: productionDeliveryPlannerCase.snapshot.artifacts.workspace.contentDigest,
  environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  verifierDigest: productionDeliveryPlannerCase.snapshot.artifacts.verifier.contentDigest,
  taskDigest: productionDeliveryPlannerCase.snapshot.artifacts.task.contentDigest,
  sourceDigestsBefore, sourceDigestsAfter, runtimePreflightBefore: runtimePreflight, runtimePreflightAfter, inputsStable, sourceDigests,
  runtime: { ...expected, nodeVersion, artifactToolContentDigest: actual.artifactToolContentDigest },
  runId,
  status: results.length === variants.length && results.every(({ admitted }, index) => admitted && results[index]?.id === variants[index]?.id) && inputsStable ? "non-certifying-admission-pass" : "non-certifying-admission-incomplete",
  results,
};
await fs.writeFile(path.join(outputDirectory, "admission-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify(receipt, null, 2));
if (results.length !== variants.length || results.some(({ admitted }, index) => !admitted || results[index]?.id !== variants[index]?.id) || !inputsStable) process.exitCode = 1;

async function required(run, command, args) {
  const result = await run(command, args);
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result;
}

function osTmpdir() { return process.env.TMPDIR || "/tmp"; }
