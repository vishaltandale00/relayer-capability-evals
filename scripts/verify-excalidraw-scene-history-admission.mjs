import { createHash } from "node:crypto";
import { appendFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixtureDirectory = process.env.RELAYER_EXCALIDRAW_FIXTURE;
const artifactsDirectory = process.env.RELAYER_EXCALIDRAW_ADMISSION_ROOT;
if (!fixtureDirectory || !artifactsDirectory) throw new Error("Set RELAYER_EXCALIDRAW_FIXTURE and RELAYER_EXCALIDRAW_ADMISSION_ROOT to durable absolute paths.");
if (!isAbsolute(fixtureDirectory) || !isAbsolute(artifactsDirectory)) throw new Error("Excalidraw fixture and admission root paths must be absolute.");
const outputWithinRepository = relative(root, artifactsDirectory);
if (outputWithinRepository === "" || (!outputWithinRepository.startsWith("..") && !isAbsolute(outputWithinRepository))) throw new Error("Excalidraw admission evidence must be written outside the source repository.");
await mkdir(artifactsDirectory, { recursive: true });
if ((await readdir(artifactsDirectory)).length) throw new Error("Excalidraw admission root must be empty; prior evidence is never overwritten.");

await writeFile(join(artifactsDirectory, "run-state.json"), `${JSON.stringify({ schemaVersion: 1, status: "started" }, null, 2)}\n`, { flag: "wx" });
const recordFatal = async (cause) => {
  const error = cause instanceof Error ? cause.message : String(cause);
  await writeFile(join(artifactsDirectory, "run-state.json"), `${JSON.stringify({ schemaVersion: 1, status: "error", error }, null, 2)}\n`);
  process.stderr.write(`${error}\n`);
  process.exit(1);
};
process.once("uncaughtException", recordFatal);
process.once("unhandledRejection", recordFatal);


let commandSequence = 0;
const loggedRun = (command, args, options) => new Promise((resolveCommand, rejectCommand) => {
  const sequence = ++commandSequence;
  const startedAt = new Date().toISOString();
  const child = spawn(command, [...args], { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += String(chunk); });
  child.stderr.on("data", (chunk) => { stderr += String(chunk); });
  child.once("error", rejectCommand);
  child.once("close", async (code) => {
    const result = { exitCode: code ?? 1, stdout, stderr };
    const record = { sequence, startedAt, finishedAt: new Date().toISOString(), command, args, cwd: options.cwd, ...result };
    await appendFile(join(artifactsDirectory, "commands.jsonl"), `${JSON.stringify(record)}\n`);
    await appendFile(join(artifactsDirectory, "command-output.log"), `\n=== ${sequence} ${command} ${args.join(" ")} (${options.cwd}) exit=${result.exitCode} ===\n[stdout]\n${stdout}\n[stderr]\n${stderr}\n`);
    resolveCommand(result);
  });
});

const runtime = await import(resolve(root, "packages/capability-evals/dist/project-cases/excalidraw-scene-history.js"));
const { EXCALIDRAW_ADMISSION_PORTFOLIO_V1: portfolio, EXCALIDRAW_QUALIFICATION_AUTHORITY_V1: qualificationAuthority, excalidrawSceneHistoryCase, runExcalidrawAdmissionPortfolio } = runtime;
const solution = resolve(root, "eval-cases/excalidraw-scene-history/solution");
const expected = portfolio.expectedFailures;
const entries = Object.freeze([
  Object.freeze({ id: portfolio.baselineId, expectation: "red", patchPaths: Object.freeze([]), expectedFailedChecks: expected[portfolio.baselineId] }),
  Object.freeze({ id: "green-functional", expectation: "green", patchPaths: Object.freeze([join(solution, "green-functional.patch")]) }),
  Object.freeze({ id: "green-command-log", expectation: "green", patchPaths: Object.freeze([join(solution, "green-command-log.patch")]) }),
  ...portfolio.mutantIds.map((id) => Object.freeze({ id, expectation: "mutant", patchPaths: Object.freeze(id === "mutant-forged-verdict" ? [join(solution, "mutants/forged-verdict.patch")] : [join(solution, "green-functional.patch"), join(solution, `mutants/${id.slice("mutant-".length)}.patch`)]), expectedFailedChecks: expected[id] })),
]);
const manifest = JSON.parse(await readFile(join(solution, "reference-manifest.json"), "utf8"));
const inputPaths = [
  fileURLToPath(import.meta.url),
  resolve(root, "packages/capability-evals/src/project-cases/excalidraw-scene-history.ts"),
  resolve(root, "packages/capability-evals/dist/project-cases/excalidraw-scene-history.js"),
  resolve(root, "packages/capability-evals/dist/index.js"),
  resolve(root, "package.json"),
  resolve(root, "package-lock.json"),
  resolve(solution, "reference-manifest.json"),
  ...manifest.inputs.map(({ path }) => resolve(root, path)),
];
const before = await snapshot(inputPaths);
let result = null;
let error = null;
try {
  result = await runExcalidrawAdmissionPortfolio({ fixtureDirectory, artifactsDirectory, portfolioId: portfolio.id, entries, runCommand: loggedRun });
} catch (cause) {
  error = cause instanceof Error ? cause.message : String(cause);
} finally {
  const after = await snapshot(inputPaths);
  const inputsStable = complete(before) && complete(after) && JSON.stringify(before) === JSON.stringify(after);
  const receipt = {
    schemaVersion: 1,
    status: !error && inputsStable && result?.admitted ? "passed" : "failed",
    portfolioId: portfolio.id,
    requiredRoster: [portfolio.baselineId, ...portfolio.greenIds, ...portfolio.mutantIds],
    caseId: excalidrawSceneHistoryCase.snapshot.id,
    caseSnapshotDigest: excalidrawSceneHistoryCase.snapshotDigest,
    verifierDigest: excalidrawSceneHistoryCase.snapshot.artifacts.verifier.contentDigest,
    qualificationAuthority,
    referenceDigest: excalidrawSceneHistoryCase.snapshot.artifacts.reference.contentDigest,
    environment: { node: process.versions.node, platform: process.platform, architecture: process.arch, executable: process.execPath, executableDigest: await digestPath(process.execPath) },
    sourceInputsBefore: before,
    sourceInputsAfter: after,
    inputsStable,
    result,
    error,
  };
  await writeFile(join(artifactsDirectory, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  await writeFile(join(artifactsDirectory, "run-state.json"), `${JSON.stringify({ schemaVersion: 1, status: receipt.status }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (receipt.status !== "passed") process.exitCode = 1;
}

async function snapshot(paths) { return Object.fromEntries(await Promise.all(paths.map(async (path) => { try { return [path.slice(root.length + 1), { status: "hashed", digest: await digestPath(path) }]; } catch (cause) { return [path.slice(root.length + 1), { status: "error", error: cause instanceof Error ? cause.message : String(cause) }]; } }))); }
function complete(value) { return Object.values(value).every(({ status }) => status === "hashed"); }
async function digestPath(path) { return `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`; }
