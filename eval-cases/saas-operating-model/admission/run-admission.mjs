import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const nodeExecutable = process.env.RELAYER_SPREADSHEET_NODE;
const nodeModulesDirectory = process.env.RELAYER_SPREADSHEET_NODE_MODULES;
if (!nodeExecutable || !nodeModulesDirectory) throw new Error("Set RELAYER_SPREADSHEET_NODE and RELAYER_SPREADSHEET_NODE_MODULES.");
const runtime = { nodeExecutable, nodeModulesDirectory }; const exec = promisify(execFile);
const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
async function digestTree(directory) { const entries = []; async function visit(current, relative = "") { for (const entry of (await fs.readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const child = path.join(current, entry.name); const name = path.join(relative, entry.name); if (entry.isDirectory()) await visit(child, name); else if (entry.isFile()) entries.push(`${name}\0${digest(await fs.readFile(child))}`); } } await visit(directory); return digest(entries.join("\n")); }
await exec("npm", ["run", "build", "-w", "@relayer/eval-runner"], { cwd: path.resolve(new URL("../../..", import.meta.url).pathname) });
const { ArtifactToolWorkbookInspector, gradeSaasOperatingModelWorkspace, materializeSaasOperatingModelFixture, saasOperatingModelCase } = await import("../../../packages/eval-runner/dist/index.js");
const runCommand = async (command, args, { cwd, env }) => { try { const value = await exec(command, args, { cwd, env: { ...process.env, ...env } }); return { exitCode: 0, stdout: value.stdout, stderr: value.stderr }; } catch (error) { return { exitCode: error.code || 1, stdout: error.stdout || "", stderr: error.stderr || String(error) }; } };
const inspector = new ArtifactToolWorkbookInspector(runtime);
const portfolio = [
  { id: "baseline", build: false, expect: "red" },
  { id: "green-a", build: true, variant: "a", mutant: "none", expect: "green" },
  { id: "green-b", build: true, variant: "b", mutant: "none", expect: "green" },
  { id: "mutant-hardcoded", build: true, variant: "a", mutant: "hardcoded", expect: "red", gate: "formula-lineage" },
  { id: "mutant-omitted-source", build: true, variant: "b", mutant: "omitted-source", expect: "red", gate: "source-coverage:payments" },
  { id: "mutant-same-scenarios", build: true, variant: "a", mutant: "same-scenarios", expect: "red", gate: "forecast-scenarios:materially-different" },
];
const root = await fs.mkdtemp(path.join(os.tmpdir(), "relayer-saas-admission-")); const results = [];
for (const candidate of portfolio) {
  const workspaceDirectory = path.join(root, candidate.id);
  const fixture = await materializeSaasOperatingModelFixture({ workspaceDirectory, runtime, runCommand, platform: "darwin" });
  if (candidate.build) {
    const scriptDir = path.join(workspaceDirectory, ".relayerspreadsheet"); await fs.mkdir(scriptDir, { recursive: true });
    await fs.copyFile(new URL("./create-workbooks.mjs", import.meta.url), path.join(scriptDir, "create-workbooks.mjs"));
    await exec(nodeExecutable, [path.join(scriptDir, "create-workbooks.mjs"), workspaceDirectory, candidate.variant, candidate.mutant], { cwd: workspaceDirectory });
    await fs.rm(path.join(workspaceDirectory, "deliverables", "saas-operating-model.xlsx.inspect.ndjson"), { force: true });
    await runCommand("git", ["add", "deliverables/saas-operating-model.xlsx"], { cwd: workspaceDirectory });
    await runCommand("git", ["commit", "--quiet", "-m", `Admission ${candidate.id}`], { cwd: workspaceDirectory });
  }
  const checks = await gradeSaasOperatingModelWorkspace({ workspaceDirectory, baseRevision: fixture.seededCommit, inspector, runCommand });
  const passed = checks.every((check) => check.passed); const target = candidate.gate && checks.find((check) => check.name.includes(candidate.gate));
  const admitted = candidate.expect === "green" ? passed : !passed && (!candidate.gate || target?.passed === false);
  const workbookPath = path.join(workspaceDirectory, "deliverables", "saas-operating-model.xlsx"); const workbookDigest = candidate.build ? digest(await fs.readFile(workbookPath)) : null;
  const renderDigests = candidate.expect === "green" && passed ? (await inspector.inspect(workbookPath)).sheets.map((sheet) => ({ sheet: sheet.name, digest: sheet.renderDigest, bytes: sheet.renderBytes })) : [];
  results.push({ id: candidate.id, admitted, passed, workbookDigest, renderDigests, failedChecks: checks.filter((check) => !check.passed).map((check) => check.name), failedDetails: checks.filter((check) => !check.passed).map((check) => ({ name: check.name, detail: check.detail })), target: target?.name ?? null });
  await fs.rm(workspaceDirectory, { recursive: true, force: true });
}
const sourceFiles = ["create-workbooks.mjs", "run-admission.mjs", "../../../packages/eval-runner/src/project-cases/saas-operating-model.ts", "../../../packages/eval-runner/src/project-cases/spreadsheet-artifact-inspector.ts"];
const sourceDigest = digest((await Promise.all(sourceFiles.map(async (file) => `${file}\0${await fs.readFile(new URL(file, import.meta.url), "utf8")}`))).join("\n"));
const runtimeDigest = await digestTree(path.join(nodeModulesDirectory, "@oai", "artifact-tool"));
const output = { schemaVersion: 1, caseId: saasOperatingModelCase.definition.id, verifierDigest: saasOperatingModelCase.snapshot.artifacts.verifier.contentDigest, sourceDigest, runtime: { artifactTool: "2.8.52", node: process.version, contentDigest: runtimeDigest, nodeContentDigest: digest(await fs.readFile(nodeExecutable)) }, review: { status: "non-certifying-no-pr", note: "Deterministic admission evidence; adversarial review is reported separately and invalidates on source change." }, results };
await fs.writeFile(new URL("./admission-receipt.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
if (!results.every((result) => result.admitted)) process.exitCode = 1;
