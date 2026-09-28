import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256,
  JUPYTERLAB_UPSTREAM_COMMIT,
  JUPYTERLAB_UPSTREAM_TREE,
  JUPYTERLAB_YARNRC_SHA256,
  gradeJupyterLabExecutionBundlesWorkspace,
  jupyterLabExecutionBundlesCase,
  materializeJupyterLabExecutionBundlesFixture,
} from "../packages/capability-evals/dist/index.js";
import { digestAutonomousCaseSnapshot } from "@relayer/eval-runner";
import {
  JUPYTERLAB_ADMISSION_CHECK_ROSTER,
  JUPYTERLAB_ADMISSION_PORTFOLIO,
  sameOrderedValues,
} from "./lib/jupyterlab-admission-contract.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, "..");
const sdkDistRoot = dirname(fileURLToPath(import.meta.resolve("@relayer/eval-runner")));
const admissionRoot = process.env.RELAYER_JUPYTERLAB_ADMISSION_ROOT;
const sourceCache = process.env.RELAYER_JUPYTERLAB_SOURCE_CACHE;
if (!admissionRoot || !sourceCache)
  throw new Error(
    "Set durable RELAYER_JUPYTERLAB_ADMISSION_ROOT and RELAYER_JUPYTERLAB_SOURCE_CACHE paths.",
  );
if (
  process.platform !== "darwin" ||
  process.arch !== "arm64" ||
  process.versions.node !== "22.23.2"
)
  throw new Error(
    `JupyterLab admission requires darwin/arm64 Node 22.23.2; received ${process.platform}/${process.arch} Node ${process.versions.node}.`,
  );
await mkdir(admissionRoot, { recursive: true });
if ((await readdir(admissionRoot)).length !== 0)
  throw new Error(
    "JupyterLab admission root must be empty; prior evidence is never overwritten.",
  );
await mkdir(join(admissionRoot, "workspaces"));
await mkdir(join(admissionRoot, "results"));

const inputFiles = [
  fileURLToPath(import.meta.url),
  "scripts/lib/jupyterlab-admission-contract.mjs",
  "eval-cases/jupyterlab-execution-bundles/solution/README.md",
  "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
  "eval-cases/jupyterlab-execution-bundles/solution/green-normalized.patch",
  "packages/capability-evals/src/project-cases/jupyterlab-execution-bundles.ts",
  "packages/capability-evals/test/jupyterlab-execution-bundles.test.ts",
  "packages/capability-evals/dist/index.js",
  "packages/capability-evals/dist/project-cases/jupyterlab-execution-bundles.js",
  "packages/capability-evals/package.json",
  "packages/capability-evals/tsconfig.build.json",
  "package.json",
  "package-lock.json",
].map((path) => resolve(repositoryRoot, path)).concat([
  resolve(sdkDistRoot, "index.js"),
  resolve(sdkDistRoot, "cases/catalog.js"),
  resolve(sdkDistRoot, "cases/contracts.js"),
]);
let sourceInputsBefore = {};
let results = [];

try {
  await runAdmission();
} catch (cause) {
  const sourceInputsAfter = await snapshotInputs(inputFiles);
  const receipt = {
    schemaVersion: 1,
    status: "error",
    error: cause instanceof Error ? cause.message : String(cause),
    sourceInputsBefore,
    sourceInputsAfter,
    inputsStable: false,
    results,
  };
  await writeFile(
    join(admissionRoot, "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { flag: "wx" },
  );
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  process.exitCode = 1;
}

async function runAdmission() {
  sourceInputsBefore = await snapshotInputs(inputFiles);
  const nodeExecutableDigest = sha256(await readFile(process.execPath));
  const sourceText = await readFile(
    resolve(
      repositoryRoot,
      "packages/capability-evals/src/project-cases/jupyterlab-execution-bundles.ts",
    ),
    "utf8",
  );
  const normalizedSource = sourceText.replace(
    /export const JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256 = "[a-f0-9]{64}";/,
    'export const JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256 = "<normalized>";',
  );
  const normalizedSourceDigest = createHash("sha256")
    .update(normalizedSource)
    .digest("hex");
  if (
    normalizedSourceDigest !==
    JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256
  )
    throw new Error(
      "JupyterLab normalized TypeScript source identity drifted from the compiled verifier authority.",
    );
  if (
    digestAutonomousCaseSnapshot(jupyterLabExecutionBundlesCase.snapshot) !==
    jupyterLabExecutionBundlesCase.snapshotDigest
  )
    throw new Error("JupyterLab compiled case snapshot digest drifted.");

  const baseline = join(admissionRoot, "pinned-baseline");
  await materializeJupyterLabExecutionBundlesFixture({
    cacheDirectory: sourceCache,
    workspaceDirectory: baseline,
    platform: "darwin",
    nodeVersion: process.versions.node,
  });
  results = [];
  for (const entry of JUPYTERLAB_ADMISSION_PORTFOLIO) {
    const resultPath = join(admissionRoot, "results", `${entry.id}.json`);
    await writeFile(
      resultPath,
      `${JSON.stringify({ schemaVersion: 1, id: entry.id, role: entry.role, status: "started" }, null, 2)}\n`,
      { flag: "wx" },
    );
    const workspace = join(admissionRoot, "workspaces", entry.id);
    let checks = [];
    let graderError = null;
    let setupError = null;
    let patchDigest = null;
    let protectedConfigMutation = null;
    try {
      await execFileAsync("git", [
        "clone",
        "--local",
        "--no-hardlinks",
        baseline,
        workspace,
      ]);
      if (entry.patch) {
        const patchPath = resolve(repositoryRoot, entry.patch);
        patchDigest = sha256(await readFile(patchPath));
        await execFileAsync("git", ["apply", patchPath], { cwd: workspace });
      }
      const implementation = join(
        workspace,
        "packages/notebook/src/executionbundle.ts",
      );
      if (entry.createMissingFeature)
        await writeFile(implementation, "export {};\n");
      if (entry.replace) {
        const source = await readFile(implementation, "utf8");
        if (source.split(entry.replace[0]).length !== 2)
          throw new Error(`${entry.id} mutation anchor was not unique.`);
        await writeFile(
          implementation,
          source.replace(entry.replace[0], entry.replace[1]),
        );
      }
      if (entry.protectedConfigMutation) {
        const mutationPath = join(
          workspace,
          entry.protectedConfigMutation.path,
        );
        await writeFile(mutationPath, entry.protectedConfigMutation.append, {
          flag: "a",
        });
        const actualDigest = sha256Hex(await readFile(mutationPath));
        protectedConfigMutation = {
          path: entry.protectedConfigMutation.path,
          expectedDigest: JUPYTERLAB_YARNRC_SHA256,
          actualDigest,
          expectedError: `Pinned JupyterLab ${entry.protectedConfigMutation.path} digest mismatch: expected ${JUPYTERLAB_YARNRC_SHA256}, received ${actualDigest}.`,
        };
      }
      if (entry.postTestDelta) {
        const test = join(
          workspace,
          "packages/notebook/test/executionbundle.spec.ts",
        );
        await writeFile(
          test,
          `import { appendFileSync } from 'node:fs';\nimport { join } from 'node:path';\n${await readFile(test, "utf8")}\nafterAll(() => appendFileSync(join(__dirname, '${entry.postTestMutationPath}'), '\\n// candidate post-test mutation'));\n`,
        );
      }
      if (!entry.noCommit) {
        await execFileAsync("git", ["add", "--all"], { cwd: workspace });
        await execFileAsync(
          "git",
          [
            "-c",
            "user.name=Relayer Admission",
            "-c",
            "user.email=admission@invalid.example",
            "commit",
            "--quiet",
            "-m",
            entry.id,
          ],
          { cwd: workspace },
        );
      }
      try {
        checks = await gradeJupyterLabExecutionBundlesWorkspace({
          workspaceDirectory: workspace,
        });
      } catch (error) {
        graderError = error instanceof Error ? error.message : String(error);
      }
    } catch (error) {
      setupError = error instanceof Error ? error.message : String(error);
    }

    const actualRoster = checks.map(({ name }) => name);
    const failedChecks = checks
      .filter(({ passed }) => !passed)
      .map(({ name }) => name);
    const rosterComplete =
      graderError !== null && entry.protectedConfigMutation
        ? checks.length === 0
        : sameOrderedValues(actualRoster, JUPYTERLAB_ADMISSION_CHECK_ROSTER);
    const expectationsMet =
      setupError === null &&
      rosterComplete &&
      (entry.protectedConfigMutation
        ? graderError === protectedConfigMutation?.expectedError
        : graderError === null &&
          sameOrderedValues(failedChecks, entry.expectedFailedChecks));
    const result = {
      schemaVersion: 1,
      id: entry.id,
      role: entry.role,
      status: expectationsMet
        ? "passed"
        : setupError || graderError
          ? "error"
          : "failed",
      patchDigest,
      protectedConfigMutation,
      expectedFailedChecks: entry.expectedFailedChecks || [],
      rosterComplete,
      expectationsMet,
      setupError,
      graderError,
      failedChecks,
      checks,
    };
    results.push(result);
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  }

  const sourceInputsAfter = await snapshotInputs(inputFiles);
  const inputsStable =
    snapshotsComplete(sourceInputsBefore) &&
    snapshotsComplete(sourceInputsAfter) &&
    sameOrderedValues(sourceInputsAfter, sourceInputsBefore);
  const passed =
    inputsStable && results.every(({ expectationsMet }) => expectationsMet);
  const receipt = {
    schemaVersion: 1,
    status: passed ? "passed" : "failed",
    caseId: jupyterLabExecutionBundlesCase.snapshot.id,
    caseSnapshotDigest: jupyterLabExecutionBundlesCase.snapshotDigest,
    verifierDigest:
      jupyterLabExecutionBundlesCase.snapshot.artifacts.verifier.contentDigest,
    normalizedVerifierSourceSha256:
      JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256,
    upstreamCommit: JUPYTERLAB_UPSTREAM_COMMIT,
    upstreamTree: JUPYTERLAB_UPSTREAM_TREE,
    sourceInputsBefore,
    sourceInputsAfter,
    sourceInputsDigest: sha256(Buffer.from(JSON.stringify(sourceInputsBefore))),
    inputsStable,
    environment: {
      platform: process.platform,
      architecture: process.arch,
      node: process.versions.node,
      nodeExecutable: process.execPath,
      nodeExecutableDigest,
    },
    productionMaterializerAndGraderExercised: true,
    results,
  };
  await writeFile(
    join(admissionRoot, "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
    { flag: "wx" },
  );
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  if (!passed) process.exitCode = 1;
}

async function snapshotInputs(paths) {
  return Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => {
        const name = path.slice(repositoryRoot.length + 1);
        try {
          return [
            name,
            { status: "hashed", digest: sha256(await readFile(path)) },
          ];
        } catch (cause) {
          return [
            name,
            {
              status: "error",
              error: cause instanceof Error ? cause.message : String(cause),
            },
          ];
        }
      }),
    ),
  );
}

function snapshotsComplete(snapshot) {
  return Object.values(snapshot).every(({ status }) => status === "hashed");
}
function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}
