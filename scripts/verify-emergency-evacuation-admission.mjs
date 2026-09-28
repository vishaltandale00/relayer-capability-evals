import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  EMERGENCY_EVACUATION_NODE_RUNTIME,
  emergencyEvacuationCase,
  preflightEmergencyEvacuationEnvironment,
} from "../packages/capability-evals/dist/index.js";

class UnavailableError extends Error {}

const repositoryRoot = resolve(import.meta.dirname, "..");
const evidenceRoot = process.env.RELAYER_EMERGENCY_ADMISSION_ROOT;
if (!evidenceRoot) throw new Error("Set an empty durable RELAYER_EMERGENCY_ADMISSION_ROOT path.");
await mkdir(evidenceRoot, { recursive: true });
if ((await readdir(evidenceRoot)).length !== 0) throw new Error("Emergency admission root must be empty; prior evidence is never overwritten.");

const reportPath = join(evidenceRoot, "vitest-report.json");
const logPath = join(evidenceRoot, "vitest-raw.log");
const receiptPath = join(evidenceRoot, "receipt.json");
const testPath = "packages/capability-evals/test/emergency-evacuation-case.test.ts";
const boundFiles = [
  "scripts/verify-emergency-evacuation-admission.mjs",
  "packages/capability-evals/src/project-cases/emergency-evacuation-case.ts",
  "packages/capability-evals/dist/project-cases/emergency-evacuation-case.js",
  "packages/capability-evals/dist/index.js",
  testPath,
  "packages/capability-evals/test/fixtures/emergency-evacuation/priority-first-solver.mjs",
  "packages/capability-evals/test/fixtures/emergency-evacuation/exhaustive-solver.mjs",
  "package-lock.json",
];
const sourceInputs = await snapshotBoundFiles();
let receipt = {
  schemaVersion: 1,
  caseId: emergencyEvacuationCase.snapshot.id,
  caseSnapshotDigest: emergencyEvacuationCase.snapshotDigest,
  verifierDigest: emergencyEvacuationCase.snapshot.artifacts.verifier.contentDigest,
  status: "unavailable",
  environment: { platform: process.platform, architecture: process.arch, node: process.versions.node },
  runtime: null,
  sourceInputs,
  sourceInputsAfter: null,
  sourceInputsStable: false,
  sourceInputsDigest: sha256(Buffer.from(JSON.stringify(sourceInputs))),
  report: null,
  rawLog: null,
  result: null,
};

try {
  if (Object.values(sourceInputs).some((value) => !value.startsWith("sha256:"))) throw new Error("One or more bound admission inputs were unavailable before execution.");
  const executable = await realpath(process.execPath);
  const executableDigest = await hashFile(executable);
  await access("/usr/bin/sandbox-exec");
  if (process.platform !== EMERGENCY_EVACUATION_NODE_RUNTIME.platform
    || process.arch !== EMERGENCY_EVACUATION_NODE_RUNTIME.architecture
    || process.versions.node !== EMERGENCY_EVACUATION_NODE_RUNTIME.version
    || executableDigest !== EMERGENCY_EVACUATION_NODE_RUNTIME.executableDigest) {
    throw new UnavailableError(`Pinned runtime mismatch: ${process.platform}/${process.arch} Node ${process.versions.node} ${executableDigest}.`);
  }
  const preflight = await preflightEmergencyEvacuationEnvironment({ nodeExecutable: executable, cwd: repositoryRoot });
  if (!preflight.available) throw new UnavailableError(preflight.reason);
  receipt.runtime = { ...preflight.runtime, executableDigest };

  const run = await runVitest(testPath, reportPath, logPath);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const assertions = report.testResults?.flatMap((file) => file.assertionResults || []) || [];
  const skipped = assertions.filter(({ status }) => status === "pending" || status === "skipped" || status === "todo");
  const failed = assertions.filter(({ status }) => status === "failed");
  const unexpectedStatuses = assertions.filter(({ status }) => status !== "passed");
  const names = assertions.filter(({ status }) => status === "passed").map(({ fullName, title }) => fullName || title || "");
  const required = [
    "keeps the untouched baseline red",
    "accepts two materially different reasonable planners",
    "rejects shortcut mutants with independent predicate evidence",
    "rejects committed symlinks",
    "rejects regular committed CLIs that execute uncommitted external code",
    "does not expose host environment secrets",
    "keeps valid-scenario evidence when an invalid-input candidate deletes its input",
    "contains malformed candidate structures",
    "enforces the disclosed Node built-ins-only delivery boundary",
    "rejects forbidden dependencies before launching any candidate CLI",
    "rejects a hard-coded frozen answer",
    "reports pinned runtime identity",
  ];
  const missingRequired = required.filter((needle) => !names.some((name) => name.includes(needle)));
  const passed = run.exitCode === 0 && report.success === true && assertions.length > 0
    && unexpectedStatuses.length === 0 && missingRequired.length === 0;
  receipt = { ...receipt, status: passed ? "passed" : "failed", result: { outerExitCode: run.exitCode, reportSuccess: report.success === true, total: assertions.length, passed: assertions.filter(({ status }) => status === "passed").length, failed: failed.map(({ fullName, title }) => fullName || title), skipped: skipped.map(({ fullName, title }) => fullName || title), unexpectedStatuses: unexpectedStatuses.map(({ fullName, title, status }) => ({ name: fullName || title, status })), missingRequired } };
  if (!passed) throw new Error("Emergency admission portfolio did not satisfy its inner assertion contract.");
} catch (error) {
  if (error instanceof UnavailableError) receipt = { ...receipt, status: "unavailable", result: { reason: error.message } };
  else if (receipt.status !== "failed") receipt = { ...receipt, status: "failed", result: { reason: error instanceof Error ? error.message : String(error) } };
} finally {
  const sourceInputsAfter = await snapshotBoundFiles();
  const sourceInputsStable = JSON.stringify(sourceInputsAfter) === JSON.stringify(sourceInputs);
  const reportEvidence = await evidenceFile(reportPath, "vitest-report.json");
  const rawLogEvidence = await evidenceFile(logPath, "vitest-raw.log");
  const evidenceComplete = typeof reportEvidence.digest === "string" && typeof rawLogEvidence.digest === "string";
  receipt = {
    ...receipt,
    status: receipt.status === "passed" && (!sourceInputsStable || !evidenceComplete) ? "failed" : receipt.status,
    sourceInputsAfter,
    sourceInputsStable,
    report: reportEvidence,
    rawLog: rawLogEvidence,
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
}

process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
if (receipt.status !== "passed") process.exitCode = receipt.status === "unavailable" ? 2 : 1;

async function runVitest(path, output, log) {
  const child = spawn(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "--reporter=json", `--outputFile=${output}`, path], { cwd: repositoryRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const raw = createWriteStream(log, { flags: "wx" });
  child.stdout.pipe(raw, { end: false }); child.stderr.pipe(raw, { end: false });
  const exitCode = await new Promise((resolveExit, reject) => { child.once("error", reject); child.once("close", resolveExit); });
  await new Promise((resolveClose, reject) => { raw.once("error", reject); raw.end(resolveClose); });
  return { exitCode };
}
async function hashFile(path) { const hash = createHash("sha256"); for await (const chunk of createReadStream(path)) hash.update(chunk); return `sha256:${hash.digest("hex")}`; }
async function snapshotBoundFiles() { return Object.fromEntries(await Promise.all(boundFiles.map(async (path) => { try { return [path, sha256(await readFile(resolve(repositoryRoot, path)))]; } catch (error) { return [path, `error:${error instanceof Error ? error.message : String(error)}`]; } }))); }
async function evidenceFile(path, name) { try { return { path: name, digest: await hashFile(path) }; } catch (error) { return { path: name, error: error instanceof Error ? error.message : String(error) }; } }
function sha256(value) { return `sha256:${createHash("sha256").update(value).digest("hex")}`; }
