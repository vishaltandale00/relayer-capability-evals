import { createHash, randomUUID } from "node:crypto";
import { execFile, fork } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { bindAutonomousCaseSnapshot } from "@relayer/eval-runner";
import { createAutonomousCaseSnapshot } from "@relayer/eval-runner";
import type { EvalCheck } from "@relayer/eval-runner";
import type {
  CommandResult,
  CommandRunner,
  ProjectEvalThreadDefinition,
} from "@relayer/eval-runner";

export const JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID =
  "jupyterlab.reproducible-execution-bundles" as const;
export const JUPYTERLAB_REPOSITORY_URL =
  "https://github.com/jupyterlab/jupyterlab.git" as const;
export const JUPYTERLAB_UPSTREAM_COMMIT =
  "9a217d024d13ef82c8de060a9fed8b430d28424a" as const;
export const JUPYTERLAB_UPSTREAM_TREE =
  "f75d058600de259d858001471410d67729405070" as const;
export const JUPYTERLAB_PACKAGE_MANAGER =
  "yarn@3.5.0-repository-runtime" as const;
export const JUPYTERLAB_NODE_RANGE = "22.23.2" as const;
export const JUPYTERLAB_YARN_LOCK_SHA256 =
  "5898a92ef8e6a945267e7008d5dbd1a837507c5582bea0575610daec70d52656" as const;
export const JUPYTERLAB_YARN_RUNTIME_SHA256 =
  "e4fc5f94867cd0b492fb0a644f14e7b47c4387bc75d46b56e86db6d0f1a6cb97" as const;
export const JUPYTERLAB_YARNRC_SHA256 =
  "2c0b85ab0efb4dd97c5720d1f31244b60564fceda112d32d6cdc5a2b8a5d5e86" as const;
export const JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256 = "b09bfec865c29fecf291f493c8d4832c409bdc029cb869c0fe6285f7edda5284";
const JUPYTERLAB_NOTEBOOK_MANIFEST_SHA256 =
  "7add2671e10e0d25349ad4d2bdf77f331863e30a7e9133d0ea91c70bff9c2b1b";
const JUPYTERLAB_NOTEBOOK_JEST_CONFIG_SHA256 =
  "b6eb3f4e5e93b28cfed1624c7443e9b3096110231087152ce755abf81eea17e2";
const JUPYTERLAB_NOTEBOOK_TSCONFIG_SHA256 =
  "6501276cdc9418644fc5aac6be6df640237abcc144129c76abcd00a5b0b66ec0";
const JUPYTERLAB_TESTING_MANIFEST_SHA256 =
  "cd5efbe1f802a85311d623d18f9213bca33fa34f80cc6159fabd801981653dfc";
const JUPYTERLAB_TESTING_TSCONFIG_SHA256 =
  "7b0e6fb4f97ea120de7cc4804002c9968b2e6025ba277562dabb98e5041c050f";

const verifierCheckIds = Object.freeze([
  "public-api",
  "environment-identity",
  "ordered-execution-evidence",
  "output-preservation",
  "referenced-file-integrity",
  "bundle-integrity",
  "read-only-import",
  "rerun-comparison",
  "missing-inputs",
  "tamper-detection",
  "partial-execution",
  "ui-status",
] as const);

type VerifierCheckId = (typeof verifierCheckIds)[number];

export interface JupyterLabExecutionBundlesCaseDefinition {
  readonly schemaVersion: 1;
  readonly id: typeof JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID;
  readonly name: string;
  readonly description: string;
  readonly localOnly: true;
  readonly supportedPlatform: "darwin";
  readonly autonomous: true;
  readonly category: "coding";
  readonly taskType: "feature-change";
  readonly fixture: {
    readonly repositoryUrl: typeof JUPYTERLAB_REPOSITORY_URL;
    readonly upstreamCommit: typeof JUPYTERLAB_UPSTREAM_COMMIT;
    readonly upstreamTree: typeof JUPYTERLAB_UPSTREAM_TREE;
    readonly packageManager: typeof JUPYTERLAB_PACKAGE_MANAGER;
    readonly node: typeof JUPYTERLAB_NODE_RANGE;
    readonly license: "BSD-3-Clause";
    readonly expectedRuntime: {
      readonly installSeconds: 120;
      readonly buildSeconds: 60;
      readonly verifierSeconds: 10;
    };
  };
  readonly threads: readonly ProjectEvalThreadDefinition[];
}

const visibleTask = `Add first-class reproducible execution bundles to JupyterLab notebooks.

The public @jupyterlab/notebook package barrel and its stable executionbundle submodule must export four harness-independent APIs: exportExecutionBundle(input), importExecutionBundle(serialized, availableFiles), compareExecutionBundle(importedBundle, rerun, availableFiles), and executionBundleStatus(status, host). Use schemaVersion 1, base64 for embedded file bytes, and lowercase 64-character SHA-256 hex digests. An exported bundle must preserve the supplied environment identity, ordered cell execution evidence (cell ID, source, execution count, completion/error/skipped state), JSON-compatible outputs, and referenced-file bytes with per-file hashes. Its top-level integrity hash must cover every field except the integrity object itself.

Import must validate the bundle before exposing it, report verified, partial, missing-inputs, or tampered, and return a defensive deeply read-only snapshot that does not alias caller data. A partial bundle is one with any error or skipped execution. Comparing a rerun must report rerun-match, rerun-different, missing-inputs, or tampered and identify differences without depending on wall-clock timestamps. The status projection must provide a user-facing label, tone, readOnly=true, and a DOM status node for each import and comparison status. It must attach that node to the supplied host so notebook UI visibly surfaces the state without making imported evidence editable.

Add focused upstream tests whose path includes executionbundle and preserve existing notebook behavior. Do not change the pinned dependency files, notebook/testing manifests, Jest configuration, or TypeScript build configuration. This case uses the Full access profile because the pinned upstream install, build, focused tests, and local commit require subprocess creation; that authority remains confined to this local checkout, with no push, publish, deployment, or live service use. The evaluator will build @jupyterlab/notebook and exercise only these public APIs with boundary matrices; it will not inspect your source or compare it with a reference patch. Run scoped checks, make exactly one meaningful local commit on top of the pinned fixture, leave the checkout clean, and do not push or publish anything.`;

export const jupyterLabExecutionBundlesEvalCase: JupyterLabExecutionBundlesCaseDefinition =
  Object.freeze({
    schemaVersion: 1,
    id: JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID,
    name: "JupyterLab · reproducible execution bundles",
    description:
      "Adds export, sealed read-only import, rerun comparison, integrity failures, partial evidence, and visible status to real JupyterLab notebooks.",
    localOnly: true,
    supportedPlatform: "darwin",
    autonomous: true,
    category: "coding",
    taskType: "feature-change",
    fixture: Object.freeze({
      repositoryUrl: JUPYTERLAB_REPOSITORY_URL,
      upstreamCommit: JUPYTERLAB_UPSTREAM_COMMIT,
      upstreamTree: JUPYTERLAB_UPSTREAM_TREE,
      packageManager: JUPYTERLAB_PACKAGE_MANAGER,
      node: JUPYTERLAB_NODE_RANGE,
      license: "BSD-3-Clause",
      expectedRuntime: Object.freeze({
        installSeconds: 120,
        buildSeconds: 60,
        verifierSeconds: 10,
      }),
    }),
    threads: Object.freeze([
      Object.freeze({
        id: "implementation",
        name: "Implement reproducible execution bundles",
        permissionProfileId: "full",
        mutationPolicy: "writable",
        workspaceGrade: "autonomous-implementation",
        prompts: Object.freeze([visibleTask]),
      }),
    ]),
  });

const hash = (value: string) =>
  `sha256:${createHash("sha256").update(value).digest("hex")}` as const;
const environmentIdentity = JSON.stringify({
  node: JUPYTERLAB_NODE_RANGE,
  packageManager: JUPYTERLAB_PACKAGE_MANAGER,
  yarnLock: JUPYTERLAB_YARN_LOCK_SHA256,
  yarnRuntime: JUPYTERLAB_YARN_RUNTIME_SHA256,
  yarnrc: JUPYTERLAB_YARNRC_SHA256,
});

export const jupyterLabExecutionBundlesCase = bindAutonomousCaseSnapshot(
  jupyterLabExecutionBundlesEvalCase,
  createAutonomousCaseSnapshot({
    id: JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID,
    name: jupyterLabExecutionBundlesEvalCase.name,
    description: jupyterLabExecutionBundlesEvalCase.description,
    category: "coding",
    taskType: "feature-change",
    authoringStatus: "candidate",
    artifacts: {
      task: {
        kind: "visible-task",
        text: visibleTask,
        contentDigest: hash(visibleTask),
      },
      workspace: {
        kind: "frozen-workspace",
        materializerId: "jupyterlab-v4.4.9-execution-bundles-v1",
        source: JUPYTERLAB_REPOSITORY_URL,
        revision: `git-tree:${JUPYTERLAB_UPSTREAM_TREE}`,
        contentDigest: hash(
          `${JUPYTERLAB_UPSTREAM_COMMIT}:${JUPYTERLAB_UPSTREAM_TREE}`,
        ),
        environmentDigest: hash(environmentIdentity),
      },
      reference: {
        kind: "sealed-reference",
        artifactId: "jupyterlab-execution-bundles-reference-v1",
        format: "artifact-collection",
        contentDigest:
          "sha256:ff96d8a4473a4318da14171d7ef27931f33beadfb803b76f89f495efa05c77ce",
        sealedPath: "eval-cases/jupyterlab-execution-bundles/solution",
      },
      verifier: {
        kind: "sealed-verifier",
        artifactId: "jupyterlab-execution-bundles-verifier-v1",
        verifierId: "jupyterlab-execution-bundles-v1",
        contentDigest: jupyterLabExecutionBundlesVerifierDigest(),
        sealedPath:
          "packages/capability-evals/src/project-cases/jupyterlab-execution-bundles.ts",
        mandatoryGates: [
          {
            id: "bundle-contract",
            label: "Execution bundle contract",
            description:
              "Independent public-API predicates cover identity, order, outputs, files, hashes, read-only import, partial evidence, and rerun comparison.",
          },
          {
            id: "integrity-failures",
            label: "Integrity and missing-input failures",
            description:
              "Evaluator mutations prove tampering and missing inputs are detected without source inspection.",
          },
          {
            id: "visible-status",
            label: "Visible status projection",
            description:
              "Every bundle and comparison state has an immutable user-facing projection.",
          },
          {
            id: "upstream-regression",
            label: "Focused upstream regression",
            description:
              "The public notebook package builds and the candidate's focused execution-bundle tests pass through JupyterLab's repository-owned test entry point.",
          },
          {
            id: "pristine-verification",
            label: "Pristine verifier workspace",
            description:
              "Qualification applies only the committed delta to a reverified pinned fixture and proves evaluator commands did not mutate it.",
          },
          {
            id: "committed-clean-workspace",
            label: "Committed clean workspace",
            description:
              "The feature is committed and the reproducibly installed workspace remains clean without imposing a hidden exact-file allowlist.",
          },
        ],
      },
      outcomeRubric: {
        kind: "outcome-rubric",
        rubricVersion: "jupyterlab-execution-bundles-outcome-v1",
        contentDigest: hash("correctness:3;integration-quality:1"),
        criteria: [
          {
            id: "correctness",
            label: "Bundle correctness",
            description:
              "The feature preserves and authenticates reproducible evidence across export, import, and rerun.",
            weight: 3,
          },
          {
            id: "integration-quality",
            label: "JupyterLab integration quality",
            description:
              "The public API and notebook status UI fit the upstream architecture and remain maintainable.",
            weight: 1,
          },
        ],
      },
    },
  }),
);

export const jupyterLabExecutionBundlesCases = Object.freeze([
  jupyterLabExecutionBundlesCase,
]);
export const jupyterLabExecutionBundlesCaseIds = new Set([
  JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID,
]);

export interface JupyterLabFixtureReceipt {
  readonly schemaVersion: 1;
  readonly fixtureId: typeof JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID;
  readonly workspaceDirectory: string;
  readonly repositoryUrl: typeof JUPYTERLAB_REPOSITORY_URL;
  readonly upstreamCommit: typeof JUPYTERLAB_UPSTREAM_COMMIT;
  readonly upstreamTree: typeof JUPYTERLAB_UPSTREAM_TREE;
  readonly sourceRevision: `git-tree:${typeof JUPYTERLAB_UPSTREAM_TREE}`;
  readonly packageManager: typeof JUPYTERLAB_PACKAGE_MANAGER;
  readonly nodeVersion: string;
  readonly installedWithFrozenLockfile: true;
}

export async function materializeJupyterLabExecutionBundlesFixture(options: {
  readonly cacheDirectory: string;
  readonly workspaceDirectory: string;
  readonly platform?: NodeJS.Platform;
  readonly nodeVersion?: string;
  readonly runCommand?: CommandRunner;
}): Promise<JupyterLabFixtureReceipt> {
  if ((options.platform ?? process.platform) !== "darwin")
    throw new Error(
      "The pinned JupyterLab execution-bundles case is local Mac only.",
    );
  const nodeVersion = options.nodeVersion ?? process.versions.node;
  assertSupportedNode(nodeVersion);
  const runCommand = options.runCommand ?? run;
  await ensureCache(options.cacheDirectory, runCommand);
  await requireMissing(options.workspaceDirectory);
  await mkdir(dirname(options.workspaceDirectory), {
    recursive: true,
    mode: 0o700,
  });
  await required(
    runCommand,
    "git",
    [
      "clone",
      "--local",
      "--no-hardlinks",
      "--no-checkout",
      options.cacheDirectory,
      options.workspaceDirectory,
    ],
    dirname(options.workspaceDirectory),
  );
  await required(
    runCommand,
    "git",
    ["checkout", "--detach", JUPYTERLAB_UPSTREAM_COMMIT],
    options.workspaceDirectory,
  );
  await verifyFixture(options.workspaceDirectory, runCommand);
  const yarnVersion = await required(
    runCommand,
    "node",
    ["jupyterlab/staging/yarn.js", "--version"],
    options.workspaceDirectory,
  );
  if (yarnVersion.stdout.trim() !== "3.5.0")
    throw new Error(
      `Pinned JupyterLab Yarn runtime reported ${yarnVersion.stdout.trim() || "no version"}.`,
    );
  await required(
    runCommand,
    "node",
    ["jupyterlab/staging/yarn.js", "install", "--immutable"],
    options.workspaceDirectory,
  );
  const status = await required(
    runCommand,
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    options.workspaceDirectory,
  );
  if (status.stdout.trim())
    throw new Error(
      `Frozen JupyterLab install changed the tracked workspace: ${status.stdout.trim()}`,
    );
  return {
    schemaVersion: 1,
    fixtureId: JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID,
    workspaceDirectory: options.workspaceDirectory,
    repositoryUrl: JUPYTERLAB_REPOSITORY_URL,
    upstreamCommit: JUPYTERLAB_UPSTREAM_COMMIT,
    upstreamTree: JUPYTERLAB_UPSTREAM_TREE,
    sourceRevision: `git-tree:${JUPYTERLAB_UPSTREAM_TREE}`,
    packageManager: JUPYTERLAB_PACKAGE_MANAGER,
    nodeVersion,
    installedWithFrozenLockfile: true,
  };
}

export async function gradeJupyterLabExecutionBundlesWorkspace(options: {
  readonly workspaceDirectory: string;
  readonly runCommand?: CommandRunner;
  /** Test-only: synthetic unit fixtures have no pinned Git repository to rematerialize. */
  readonly testOnlyUseCandidateWorkspace?: boolean;
}): Promise<readonly EvalCheck[]> {
  const runCommand = options.runCommand ?? run;
  const status = (
    await required(
      runCommand,
      "git",
      ["status", "--porcelain=v1", "--untracked-files=all"],
      options.workspaceDirectory,
    )
  ).stdout.trim();
  const commits = lines(
    (
      await required(
        runCommand,
        "git",
        ["rev-list", `${JUPYTERLAB_UPSTREAM_COMMIT}..HEAD`],
        options.workspaceDirectory,
      )
    ).stdout,
  );
  const basedOnFixture = await runCommand(
    "git",
    ["merge-base", "--is-ancestor", JUPYTERLAB_UPSTREAM_COMMIT, "HEAD"],
    { cwd: options.workspaceDirectory },
  );
  const deliveryEligible =
    status === "" && basedOnFixture.exitCode === 0 && commits.length === 1;
  let verificationRoot: string | undefined;
  let verificationWorkspace = options.workspaceDirectory;
  let preparedDeltaDigest = "";
  if (!options.testOnlyUseCandidateWorkspace && deliveryEligible) {
    const prepared = await prepareVerificationWorkspace(
      options.workspaceDirectory,
      runCommand,
    );
    verificationRoot = prepared.root;
    verificationWorkspace = prepared.workspace;
    preparedDeltaDigest = prepared.deltaDigest;
  }
  const unavailable = (label: string): CommandResult => ({
    exitCode: 1,
    stdout: "",
    stderr: `${label} did not run because the candidate was not exactly one clean commit on the pinned fixture.`,
  });
  let build = unavailable("The build");
  let testSupportBuild = unavailable("The JupyterLab test-support build");
  let focusedTests = unavailable("Focused tests");
  let sealedPublicExport = unavailable("The sealed public-export test");
  let behaviorChecks: readonly EvalCheck[] = verifierCheckIds.map((id) =>
    failedVerifierCheck(
      id,
      "No pristine candidate delta was eligible for verification.",
    ),
  );
  let pristineIntegrity: EvalCheck = {
    name: "workspace:pristine-verification-integrity",
    passed: Boolean(options.testOnlyUseCandidateWorkspace),
    detail: options.testOnlyUseCandidateWorkspace
      ? "Synthetic unit fixture explicitly bypassed production rematerialization."
      : "No pristine candidate delta was eligible for verification.",
  };
  try {
    if (deliveryEligible || options.testOnlyUseCandidateWorkspace) {
      build = await runCommand(
        "node",
        [
          "jupyterlab/staging/yarn.js",
          "workspace",
          "@jupyterlab/notebook",
          "build",
        ],
        { cwd: verificationWorkspace },
      );
      testSupportBuild =
        build.exitCode === 0
          ? await runCommand(
              "node",
              [
                "jupyterlab/staging/yarn.js",
                "workspace",
                "@jupyterlab/testing",
                "build",
              ],
              { cwd: verificationWorkspace },
            )
          : unavailable("The JupyterLab test-support build");
      sealedPublicExport =
        build.exitCode === 0 && testSupportBuild.exitCode === 0
          ? await runSealedPublicExportTest(verificationWorkspace, runCommand)
          : unavailable("The sealed public-export test");
      behaviorChecks =
        build.exitCode === 0
          ? await runSealedVerifier(verificationWorkspace)
          : verifierCheckIds.map((id) =>
              failedVerifierCheck(
                id,
                "The public package did not build, so this independent predicate could not run.",
              ),
            );
      focusedTests =
        build.exitCode === 0 && testSupportBuild.exitCode === 0
          ? await runCommand(
              "node",
              [
                "jupyterlab/staging/yarn.js",
                "workspace",
                "@jupyterlab/notebook",
                "test",
                "--runInBand",
                "--testPathPattern=executionbundle",
              ],
              { cwd: verificationWorkspace },
            )
          : unavailable("Focused tests");
      if (!options.testOnlyUseCandidateWorkspace) {
        pristineIntegrity = await verifyPreparedWorkspaceIntegrity(
          verificationWorkspace,
          preparedDeltaDigest,
          runCommand,
        );
      }
    }
  } finally {
    if (verificationRoot)
      await rm(verificationRoot, { recursive: true, force: true });
  }
  return [
    {
      name: "workspace:implementation-build",
      passed: build.exitCode === 0 && testSupportBuild.exitCode === 0,
      detail: `${commandDetail("scoped @jupyterlab/notebook build", build)}\n${commandDetail("scoped @jupyterlab/testing build", testSupportBuild)}`,
    },
    {
      name: "workspace:focused-upstream-tests",
      passed: focusedTests.exitCode === 0,
      detail: commandDetail(
        "focused JupyterLab execution-bundle tests",
        focusedTests,
      ),
    },
    {
      name: "workspace:sealed-public-export",
      passed: sealedPublicExport.exitCode === 0,
      detail: commandDetail(
        "evaluator-owned public package export test",
        sealedPublicExport,
      ),
    },
    ...behaviorChecks,
    pristineIntegrity,
    {
      name: "workspace:meaningful-commit",
      passed: basedOnFixture.exitCode === 0 && commits.length === 1,
      detail: `${commits.length} post-fixture commit(s); pinned fixture is${basedOnFixture.exitCode === 0 ? "" : " not"} an ancestor.`,
    },
    {
      name: "workspace:implementation-clean",
      passed: status === "",
      detail:
        status === ""
          ? "The workspace is clean."
          : `Uncommitted changes remain: ${status}`,
    },
  ];
}

async function prepareVerificationWorkspace(
  candidateWorkspace: string,
  runCommand: CommandRunner,
): Promise<{
  readonly root: string;
  readonly workspace: string;
  readonly deltaDigest: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "relayer-jupyter-verifier-"));
  const workspace = join(root, "workspace");
  try {
    await required(
      runCommand,
      "git",
      [
        "clone",
        "--local",
        "--no-hardlinks",
        "--no-checkout",
        candidateWorkspace,
        workspace,
      ],
      root,
    );
    await required(
      runCommand,
      "git",
      ["checkout", "--quiet", "--detach", JUPYTERLAB_UPSTREAM_COMMIT],
      workspace,
    );
    await verifyFixture(workspace, runCommand);
    const delta = await required(
      runCommand,
      "git",
      [
        "diff",
        "--binary",
        "--no-ext-diff",
        "--no-textconv",
        `${JUPYTERLAB_UPSTREAM_COMMIT}..HEAD`,
      ],
      candidateWorkspace,
    );
    const patchPath = join(root, "candidate.patch");
    await writeFile(patchPath, delta.stdout, { encoding: "utf8", mode: 0o600 });
    await required(
      runCommand,
      "git",
      ["apply", "--index", patchPath],
      workspace,
    );
    const stagedDelta = await required(
      runCommand,
      "git",
      ["diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv"],
      workspace,
    );
    await verifyFixture(workspace, runCommand);
    await required(
      runCommand,
      "node",
      ["jupyterlab/staging/yarn.js", "install", "--immutable"],
      workspace,
    );
    await rm(join(workspace, "packages/notebook/lib"), {
      recursive: true,
      force: true,
    });
    await rm(join(workspace, "packages/testing/lib"), {
      recursive: true,
      force: true,
    });
    return {
      root,
      workspace,
      deltaDigest: createHash("sha256")
        .update(stagedDelta.stdout)
        .digest("hex"),
    };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function verifyPreparedWorkspaceIntegrity(
  workspace: string,
  expectedDeltaDigest: string,
  runCommand: CommandRunner,
): Promise<EvalCheck> {
  try {
    await verifyFixture(workspace, runCommand);
    const unstaged = await runCommand("git", ["diff", "--exit-code"], {
      cwd: workspace,
    });
    const untracked = lines(
      (
        await required(
          runCommand,
          "git",
          ["ls-files", "--others", "--exclude-standard"],
          workspace,
        )
      ).stdout,
    );
    const staged = await required(
      runCommand,
      "git",
      ["diff", "--cached", "--binary", "--no-ext-diff", "--no-textconv"],
      workspace,
    );
    const actualDeltaDigest = createHash("sha256")
      .update(staged.stdout)
      .digest("hex");
    const passed =
      unstaged.exitCode === 0 &&
      untracked.length === 0 &&
      actualDeltaDigest === expectedDeltaDigest;
    return {
      name: "workspace:pristine-verification-integrity",
      passed,
      detail: passed
        ? "Protected bytes and the staged candidate delta remained unchanged in the pristine verifier workspace."
        : `Verifier workspace drifted: unstaged=${unstaged.exitCode !== 0}, untracked=${untracked.length}, delta=${actualDeltaDigest}.`,
    };
  } catch (error) {
    return {
      name: "workspace:pristine-verification-integrity",
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export function jupyterLabExecutionBundlesVerifierDigest(): `sha256:${string}` {
  return hash(
    [
      JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256,
      ...verifierCheckIds,
      JUPYTERLAB_UPSTREAM_COMMIT,
      JUPYTERLAB_UPSTREAM_TREE,
      JUPYTERLAB_YARN_LOCK_SHA256,
      JUPYTERLAB_YARN_RUNTIME_SHA256,
      JUPYTERLAB_YARNRC_SHA256,
      JUPYTERLAB_NOTEBOOK_MANIFEST_SHA256,
      JUPYTERLAB_NOTEBOOK_JEST_CONFIG_SHA256,
      JUPYTERLAB_NOTEBOOK_TSCONFIG_SHA256,
      JUPYTERLAB_TESTING_MANIFEST_SHA256,
      JUPYTERLAB_TESTING_TSCONFIG_SHA256,
    ].join("\n"),
  );
}

interface SealedReceipt {
  readonly id: VerifierCheckId;
  readonly passed: boolean;
  readonly detail: string;
}

async function runSealedPublicExportTest(
  workspaceDirectory: string,
  runCommand: CommandRunner,
): Promise<CommandResult> {
  const testPath = join(
    workspaceDirectory,
    "packages/notebook/test/relayer.executionbundle.spec.ts",
  );
  await writeFile(testPath, sealedPublicExportTestProgram(), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  try {
    return await runCommand(
      "node",
      [
        "jupyterlab/staging/yarn.js",
        "workspace",
        "@jupyterlab/notebook",
        "test",
        "--runInBand",
        "--runTestsByPath",
        "test/relayer.executionbundle.spec.ts",
      ],
      { cwd: workspaceDirectory },
    );
  } finally {
    await rm(testPath, { force: true });
  }
}

function sealedPublicExportTestProgram(): string {
  return `import { compareExecutionBundle, executionBundleStatus, exportExecutionBundle, importExecutionBundle } from '../src';\n\ntest('exports the execution-bundle API from the public notebook package', () => {\n  expect(typeof exportExecutionBundle).toBe('function');\n  expect(typeof importExecutionBundle).toBe('function');\n  expect(typeof compareExecutionBundle).toBe('function');\n  expect(typeof executionBundleStatus).toBe('function');\n});\n`;
}

async function runSealedVerifier(
  workspaceDirectory: string,
): Promise<readonly EvalCheck[]> {
  const verifierPath = join(
    workspaceDirectory,
    ".relayer-jupyterlab-execution-bundles-verifier.mjs",
  );
  await writeFile(verifierPath, sealedVerifierProgram(), {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  let result: CommandResult;
  try {
    result = await executeSealedVerifier(verifierPath, workspaceDirectory);
  } finally {
    await rm(verifierPath, { force: true });
  }
  let receipts: readonly SealedReceipt[] = [];
  try {
    const parsed = JSON.parse(result.stdout) as unknown;
    if (Array.isArray(parsed)) receipts = parsed as readonly SealedReceipt[];
  } catch {
    receipts = [];
  }
  return verifierCheckIds.map((id) => {
    const receipt = receipts.find((entry) => entry?.id === id);
    return receipt
      ? {
          name: `workspace:bundle-${id}`,
          passed: receipt.passed,
          detail: receipt.detail,
        }
      : failedVerifierCheck(
          id,
          `The sealed verifier emitted no valid receipt. ${commandDetail("sealed verifier", result)}`,
        );
  });
}

async function executeSealedVerifier(
  verifierPath: string,
  workspaceDirectory: string,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const secret = randomUUID();
    const child = fork(verifierPath, [], {
      cwd: workspaceDirectory,
      env: process.env,
      execPath: process.execPath,
      execArgv: [],
      silent: true,
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (result: CommandResult) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      child.kill();
      resolve(result);
    };
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("message", (message: unknown) => {
      const record = message as {
        type?: unknown;
        secret?: unknown;
        checks?: unknown;
      };
      if (record?.type === "ready") {
        child.send({ secret });
      } else if (
        record?.type === "result" &&
        record.secret === secret &&
        Array.isArray(record.checks)
      ) {
        finish({
          exitCode: 0,
          stdout: JSON.stringify(record.checks),
          stderr,
        });
      }
    });
    child.once("error", (error) =>
      finish({ exitCode: 1, stdout, stderr: `${stderr}${error.message}` }),
    );
    child.once("exit", (code) => {
      if (!settled)
        finish({
          exitCode: code ?? 1,
          stdout,
          stderr:
            stderr || "Sealed verifier exited before an authenticated receipt.",
        });
    });
    timer = setTimeout(
      () =>
        finish({
          exitCode: 1,
          stdout,
          stderr: `${stderr}Sealed verifier exceeded 30 seconds.`,
        }),
      30_000,
    );
  });
}

function failedVerifierCheck(id: VerifierCheckId, detail: string): EvalCheck {
  return { name: `workspace:bundle-${id}`, passed: false, detail };
}

async function ensureCache(
  cacheDirectory: string,
  runCommand: CommandRunner,
): Promise<void> {
  try {
    await access(cacheDirectory);
    await verifyFixture(cacheDirectory, runCommand);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await mkdir(dirname(cacheDirectory), { recursive: true, mode: 0o700 });
  const temporary = `${cacheDirectory}.tmp-${randomUUID()}`;
  await mkdir(temporary, { mode: 0o700 });
  try {
    await required(runCommand, "git", ["init", "--quiet"], temporary);
    await required(
      runCommand,
      "git",
      ["remote", "add", "origin", JUPYTERLAB_REPOSITORY_URL],
      temporary,
    );
    await required(
      runCommand,
      "git",
      [
        "fetch",
        "--quiet",
        "--depth",
        "1",
        "origin",
        JUPYTERLAB_UPSTREAM_COMMIT,
      ],
      temporary,
    );
    await required(
      runCommand,
      "git",
      ["checkout", "--quiet", "--detach", "FETCH_HEAD"],
      temporary,
    );
    await verifyFixture(temporary, runCommand);
    try {
      await rename(temporary, cacheDirectory);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !["EEXIST", "ENOTEMPTY"].includes(
          (error as NodeJS.ErrnoException).code ?? "",
        )
      )
        throw error;
      await verifyFixture(cacheDirectory, runCommand);
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function verifyFixture(
  directory: string,
  runCommand: CommandRunner,
): Promise<void> {
  const commit = (
    await required(runCommand, "git", ["rev-parse", "HEAD"], directory)
  ).stdout.trim();
  const tree = (
    await required(runCommand, "git", ["rev-parse", "HEAD^{tree}"], directory)
  ).stdout.trim();
  if (
    commit !== JUPYTERLAB_UPSTREAM_COMMIT ||
    tree !== JUPYTERLAB_UPSTREAM_TREE
  ) {
    throw new Error(
      `Pinned JupyterLab source mismatch: expected ${JUPYTERLAB_UPSTREAM_COMMIT}/${JUPYTERLAB_UPSTREAM_TREE}, received ${commit}/${tree}.`,
    );
  }
  const manifest = JSON.parse(
    await readFile(join(directory, "packages/notebook/package.json"), "utf8"),
  ) as Record<string, unknown>;
  if (manifest.license !== "BSD-3-Clause" || manifest.version !== "4.4.9")
    throw new Error("Pinned JupyterLab notebook package metadata drifted.");
  const license = await readFile(join(directory, "LICENSE"), "utf8");
  if (!license.includes("Redistribution and use in source and binary forms"))
    throw new Error("Pinned JupyterLab BSD-3-Clause license is missing.");
  await verifyFileHash(directory, "yarn.lock", JUPYTERLAB_YARN_LOCK_SHA256);
  await verifyFileHash(
    directory,
    "jupyterlab/staging/yarn.js",
    JUPYTERLAB_YARN_RUNTIME_SHA256,
  );
  await verifyFileHash(directory, ".yarnrc.yml", JUPYTERLAB_YARNRC_SHA256);
  await verifyFileHash(
    directory,
    "packages/notebook/package.json",
    JUPYTERLAB_NOTEBOOK_MANIFEST_SHA256,
  );
  await verifyFileHash(
    directory,
    "packages/notebook/jest.config.js",
    JUPYTERLAB_NOTEBOOK_JEST_CONFIG_SHA256,
  );
  await verifyFileHash(
    directory,
    "packages/notebook/tsconfig.json",
    JUPYTERLAB_NOTEBOOK_TSCONFIG_SHA256,
  );
  await verifyFileHash(
    directory,
    "packages/testing/package.json",
    JUPYTERLAB_TESTING_MANIFEST_SHA256,
  );
  await verifyFileHash(
    directory,
    "packages/testing/tsconfig.json",
    JUPYTERLAB_TESTING_TSCONFIG_SHA256,
  );
}

async function verifyFileHash(
  directory: string,
  path: string,
  expected: string,
): Promise<void> {
  const actual = createHash("sha256")
    .update(await readFile(join(directory, path)))
    .digest("hex");
  if (actual !== expected)
    throw new Error(
      `Pinned JupyterLab ${path} digest mismatch: expected ${expected}, received ${actual}.`,
    );
}

function assertSupportedNode(version: string): void {
  if (version !== JUPYTERLAB_NODE_RANGE)
    throw new Error(
      `JupyterLab execution-bundles requires Node ${JUPYTERLAB_NODE_RANGE}; received ${version}.`,
    );
}

async function requireMissing(path: string): Promise<void> {
  try {
    await access(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error(
    `Refusing to reuse existing JupyterLab execution workspace: ${path}`,
  );
}

async function required(
  runCommand: CommandRunner,
  command: string,
  args: readonly string[],
  cwd: string,
): Promise<CommandResult> {
  const result = await runCommand(command, args, { cwd });
  if (result.exitCode !== 0)
    throw new Error(commandDetail(`${command} ${args.join(" ")}`, result));
  return result;
}

function commandDetail(label: string, result: CommandResult): string {
  const output = [result.stdout.trim(), result.stderr.trim()]
    .filter(Boolean)
    .join("\n");
  return `${label} exited ${result.exitCode}.${output ? `\n${output.slice(0, 4_000)}` : ""}`;
}

function lines(value: string): readonly string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const execFileAsync = promisify(execFile);
async function run(
  command: string,
  args: readonly string[],
  options: {
    readonly cwd: string;
    readonly env?: Readonly<Record<string, string>>;
  },
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, [...args], {
      cwd: options.cwd,
      env: options.env ? { ...process.env, ...options.env } : process.env,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
      timeout: 5 * 60 * 1_000,
    });
    return { exitCode: 0, stdout, stderr };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };
    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? failure.message,
    };
  }
}

function sealedVerifierProgram(): string {
  return String.raw`import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('jsdom');const dom=new JSDOM('<!doctype html><body></body>');globalThis.window=dom.window;globalThis.document=dom.window.document;
Object.freeze(assert);const arrayPush=Function.call.bind(Array.prototype.push);const bytesFrom=Uint8Array.from.bind(Uint8Array);const safeClone=structuredClone.bind(globalThis);const decode=atob.bind(globalThis);const subtleDigest=crypto.subtle.digest.bind(crypto.subtle);const objectValues=Object.values.bind(Object);const isFrozen=Object.isFrozen.bind(Object);const nodeContains=Function.call.bind(dom.window.Node.prototype.contains);const send=process.send?.bind(process);const processOnce=process.once.bind(process);const removeListeners=process.removeAllListeners.bind(process);const checks=[];const receipt=(value)=>arrayPush(checks,value);const record=async(id,fn)=>{try{await fn();receipt({id,passed:true,detail:'Public behavioral predicate passed.'})}catch(error){receipt({id,passed:false,detail:error instanceof Error?error.message:String(error)})}};
const required=['exportExecutionBundle','importExecutionBundle','compareExecutionBundle','executionBundleStatus'];
let api={};
const environment={kernel:{name:'python3',version:'3.12.5'},language:'python',packages:{pandas:'2.2.2'},platform:'linux-x86_64'};
const executions=[{cellId:'alpha',source:'print("α")',executionCount:7,state:'completed',outputs:[{output_type:'stream',name:'stdout',text:'α\n'}],startedAt:'2026-01-01T00:00:00Z'},{cellId:'beta',source:'1/0',executionCount:8,state:'completed',outputs:[{output_type:'execute_result',data:{'text/plain':'42'}}],startedAt:'2026-01-01T00:00:01Z'}];
const files=[{path:'data/input.csv',bytes:new TextEncoder().encode('name,value\nα,42\n')},{path:'config.json',bytes:new TextEncoder().encode('{"enabled":true}') }];
const sha256=async bytes=>Array.from(new Uint8Array(await subtleDigest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');const allFrozen=value=>!value||typeof value!=='object'||(isFrozen(value)&&objectValues(value).every(allFrozen));
const runChecks=async()=>{let bundle;
await record('public-api',async()=>{for(const name of required)assert.equal(typeof api[name],'function',name+' must be publicly exported')});
await record('environment-identity',async()=>{bundle=await api.exportExecutionBundle({environment,executions,referencedFiles:files});assert.deepEqual(bundle.environment,environment);assert.equal(bundle.schemaVersion,1);assert.equal(bundle.integrity.algorithm,'SHA-256')});
await record('ordered-execution-evidence',async()=>{bundle=await api.exportExecutionBundle({environment,executions,referencedFiles:files});assert.deepEqual(bundle.executions.map(x=>[x.cellId,x.executionCount,x.state]),[['alpha',7,'completed'],['beta',8,'completed']])});
await record('output-preservation',async()=>{bundle=await api.exportExecutionBundle({environment,executions,referencedFiles:files});assert.deepEqual(bundle.executions.map(x=>x.outputs),executions.map(x=>x.outputs))});
await record('referenced-file-integrity',async()=>{bundle=await api.exportExecutionBundle({environment,executions,referencedFiles:files});assert.deepEqual(bundle.referencedFiles.map(x=>x.path),files.map(x=>x.path));for(const [index,file] of bundle.referencedFiles.entries()){const embedded=bytesFrom(decode(file.content),x=>x.charCodeAt(0));assert.deepEqual(embedded,files[index].bytes);assert.equal(file.hash,await sha256(embedded))}});
await record('bundle-integrity',async()=>{bundle=await api.exportExecutionBundle({environment,executions,referencedFiles:files});assert.match(bundle.integrity.hash,/^[a-f0-9]{64}$/);const reordered=await api.exportExecutionBundle({environment,executions:[...executions].reverse(),referencedFiles:files});assert.notEqual(reordered.integrity.hash,bundle.integrity.hash);const changedEnvironment=await api.exportExecutionBundle({environment:{...environment,language:'julia'},executions,referencedFiles:files});assert.notEqual(changedEnvironment.integrity.hash,bundle.integrity.hash);const changedSource=safeClone(executions);changedSource[0].source='print("beta")';assert.notEqual((await api.exportExecutionBundle({environment,executions:changedSource,referencedFiles:files})).integrity.hash,bundle.integrity.hash);const changedFile=[files[0],{path:'config.json',bytes:new TextEncoder().encode('{"enabled":false}')}];assert.notEqual((await api.exportExecutionBundle({environment,executions,referencedFiles:changedFile})).integrity.hash,bundle.integrity.hash);const equivalentEnvironment={platform:'linux-x86_64',packages:{pandas:'2.2.2'},language:'python',kernel:{version:'3.12.5',name:'python3'}};const differentTimes=executions.map((entry,index)=>({...entry,startedAt:'2030-01-01T00:00:0'+index+'Z'}));const equivalent=await api.exportExecutionBundle({environment:equivalentEnvironment,executions:differentTimes,referencedFiles:files});assert.equal(equivalent.integrity.hash,bundle.integrity.hash)});
await record('read-only-import',async()=>{bundle=await api.exportExecutionBundle({environment,executions,referencedFiles:files});const text=JSON.stringify(bundle);const imported=await api.importExecutionBundle(text,files);assert.equal(imported.status,'verified');assert.equal(imported.readOnly,true);environment.language='mutated';assert.equal(imported.bundle.environment.language,'python');assert.equal(allFrozen(imported.bundle),true);assert.throws(()=>{imported.bundle.executions[0].outputs[0].text='changed'})});
await record('rerun-comparison',async()=>{bundle=await api.exportExecutionBundle({environment:{...environment,language:'python'},executions,referencedFiles:files});const imported=await api.importExecutionBundle(JSON.stringify(bundle),files);const same=await api.compareExecutionBundle(imported.bundle,{environment:{...environment,language:'python'},executions},files);assert.equal(same.status,'rerun-match');for(const mutate of [value=>{value.executions[1].outputs=[{output_type:'execute_result',data:{'text/plain':'43'}}]},value=>{value.executions[0].source='print("changed")'},value=>{value.environment.language='julia'}]){const rerun={environment:safeClone(environment),executions:safeClone(executions)};rerun.environment.language='python';mutate(rerun);const different=await api.compareExecutionBundle(imported.bundle,rerun,files);assert.equal(different.status,'rerun-different');assert.ok(different.differences.length>0)}});
await record('missing-inputs',async()=>{bundle=await api.exportExecutionBundle({environment:{...environment,language:'python'},executions,referencedFiles:files});const absent=await api.importExecutionBundle(JSON.stringify(bundle),files.slice(0,1));assert.equal(absent.status,'missing-inputs');assert.deepEqual(absent.missingInputs,['config.json']);const changedFiles=[files[0],{path:'config.json',bytes:new TextEncoder().encode('{"enabled":false}')}];const changed=await api.importExecutionBundle(JSON.stringify(bundle),changedFiles);assert.equal(changed.status,'missing-inputs');assert.deepEqual(changed.missingInputs,['config.json'])});
await record('tamper-detection',async()=>{bundle=await api.exportExecutionBundle({environment:{...environment,language:'python'},executions,referencedFiles:files});const tamperedOutput=safeClone(bundle);tamperedOutput.executions[0].outputs[0].text='forged\n';assert.equal((await api.importExecutionBundle(JSON.stringify(tamperedOutput),files)).status,'tampered');const tamperedFile=safeClone(bundle);tamperedFile.referencedFiles[0].content='Zm9yZ2Vk';assert.equal((await api.importExecutionBundle(JSON.stringify(tamperedFile),files)).status,'tampered');for(const malformed of ['{','null','[]','{}'])assert.equal((await api.importExecutionBundle(malformed,files)).status,'tampered');const wrongSchema=safeClone(bundle);wrongSchema.schemaVersion=2;assert.equal((await api.importExecutionBundle(JSON.stringify(wrongSchema),files)).status,'tampered')});
await record('partial-execution',async()=>{for(const state of ['skipped','error']){const partial=await api.exportExecutionBundle({environment:{...environment,language:'python'},executions:[executions[0],{...executions[1],state,executionCount:state==='skipped'?null:8,outputs:state==='skipped'?[]:[{output_type:'error',ename:'ZeroDivisionError'}]}],referencedFiles:files});const imported=await api.importExecutionBundle(JSON.stringify(partial),files);assert.equal(imported.status,'partial')}});
await record('ui-status',async()=>{for(const [status,label] of [['verified','Verified'],['partial','Partial execution'],['missing-inputs','Missing inputs'],['tampered','Tampered'],['rerun-match','Rerun matches'],['rerun-different','Rerun differs']]){const host=document.createElement('div');document.body.appendChild(host);const view=api.executionBundleStatus(status,host);assert.equal(view.label,label);assert.equal(view.readOnly,true);assert.ok(['positive','warning','negative','neutral'].includes(view.tone));assert.equal(view.node.textContent,label);assert.equal(view.node.dataset.tone,view.tone);assert.equal(view.node.getAttribute('aria-readonly'),'true');assert.equal(nodeContains(host,view.node),true)}});return checks};
removeListeners('message');processOnce('message',async message=>{try{try{api=await import('./packages/notebook/lib/executionbundle.js')}catch{api={}}const result=await runChecks();send?.({type:'result',secret:message?.secret,checks:result})}catch(error){send?.({type:'fatal',detail:error instanceof Error?error.message:String(error)})}});send?.({type:'ready'});`;
}
