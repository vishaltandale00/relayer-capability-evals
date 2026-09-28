import { createHash } from "node:crypto";
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  EXCALIDRAW_NODE_RANGE,
  EXCALIDRAW_ADMISSION_PORTFOLIO_V1,
  EXCALIDRAW_PACKAGE_MANAGER,
  EXCALIDRAW_SCENE_HISTORY_CASE_ID,
  EXCALIDRAW_SEEDED_COMMIT,
  EXCALIDRAW_SEEDED_TREE,
  EXCALIDRAW_UPSTREAM_COMMIT,
  EXCALIDRAW_UPSTREAM_TREE,
  EXCALIDRAW_VERIFIER_SOURCE_SHA256,
  excalidrawSceneHistoryCase,
  excalidrawVerifierDigest,
  gradeExcalidrawSceneHistoryWorkspace,
  materializeExcalidrawSceneHistoryFixture,
  runExcalidrawAdmissionPortfolio,
  runExcalidrawPortablePortfolio,
  seedExcalidrawCompatibilityLock,
  seedExcalidrawCompatibilityManifest,
} from "../src/project-cases/excalidraw-scene-history.js";
import type { ExcalidrawPatchAdmissionEntry } from "../src/project-cases/excalidraw-scene-history.js";
import type { CommandRunner } from "@relayer/eval-runner";

const fixtureDirectory = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "excalidraw-scene-history");
const temporaryDirectories: string[] = [];
const predicateIds = [
  "public-ui",
  "named-immutable-versions",
  "historical-branching",
  "deterministic-merge",
  "conflict-taxonomy",
  "relationship-integrity",
  "groups-and-assets",
  "undo-boundary",
  "native-assets-appstate",
  "export-boundary",
  "historical-compatibility",
] as const;

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});

describe("Excalidraw scene-history immutable case", () => {
  it("exposes a versioned durable real-workspace admission entry point", async () => {
    const [driver, packageManifest] = await Promise.all([
      readFile(join(process.cwd(), "scripts", "verify-excalidraw-scene-history-admission.mjs"), "utf8"),
      readFile(join(process.cwd(), "package.json"), "utf8").then((value) => JSON.parse(value) as { scripts: Record<string, string> }),
    ]);
    expect(packageManifest.scripts["eval:admit:excalidraw-scene-history"]).toContain("verify-excalidraw-scene-history-admission.mjs");
    expect(driver).toContain("requiredRoster");
    expect(driver).toContain("sourceInputsBefore");
    expect(driver).toContain("sourceInputsAfter");
    expect(driver).toContain("inputsStable");
    expect(driver).toContain('join(artifactsDirectory, "receipt.json")');
  });

  it("binds the normalized complete verifier source", async () => {
    const source = (await readFile(new URL("../src/project-cases/excalidraw-scene-history.ts", import.meta.url), "utf8")).replace(
      /export const EXCALIDRAW_VERIFIER_SOURCE_SHA256 = "[^"]+";/,
      'export const EXCALIDRAW_VERIFIER_SOURCE_SHA256 = "<normalized>";',
    );
    expect(createHash("sha256").update(source).digest("hex")).toBe(EXCALIDRAW_VERIFIER_SOURCE_SHA256);
  });

  it("binds the approved pinned repository, environment, substantial task, and sealed snapshot", () => {
    expect(excalidrawSceneHistoryCase.definition).toMatchObject({
      id: EXCALIDRAW_SCENE_HISTORY_CASE_ID,
      autonomous: true,
      category: "coding",
      taskType: "feature-change",
      fixture: {
        upstreamCommit: EXCALIDRAW_UPSTREAM_COMMIT,
        upstreamTree: EXCALIDRAW_UPSTREAM_TREE,
        seededCommit: EXCALIDRAW_SEEDED_COMMIT,
        seededTree: EXCALIDRAW_SEEDED_TREE,
        packageManager: EXCALIDRAW_PACKAGE_MANAGER,
        node: EXCALIDRAW_NODE_RANGE,
        license: "MIT",
      },
    });
    expect(excalidrawSceneHistoryCase.snapshot.authoringStatus).toBe("candidate");
    expect(excalidrawSceneHistoryCase.snapshot.artifacts.verifier.mandatoryGates).toHaveLength(3);
    expect(excalidrawSceneHistoryCase.snapshotDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(excalidrawVerifierDigest()).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(excalidrawVerifierDigest()).toBe(excalidrawSceneHistoryCase.snapshot.artifacts.verifier.contentDigest);

    const serializedCatalog = JSON.stringify(excalidrawSceneHistoryCase.catalogSnapshot);
    expect(serializedCatalog).not.toContain("sealedPath");
    expect(serializedCatalog).not.toContain("reference.md");
    expect(serializedCatalog).not.toContain("hiddenVerifierSource");
    expect(Object.isFrozen(excalidrawSceneHistoryCase.snapshot)).toBe(true);
  });

  it("binds the sealed reference manifest and every portable and upstream admission input", async () => {
    const manifestPath = join(process.cwd(), "eval-cases", "excalidraw-scene-history", "solution", "reference-manifest.json");
    const manifestBytes = await readFile(manifestPath);
    expect(`sha256:${createHash("sha256").update(manifestBytes).digest("hex")}`).toBe(excalidrawSceneHistoryCase.snapshot.artifacts.reference.contentDigest);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as { schemaVersion: number; portfolioId: string; inputs: Array<{ path: string; digest: string }> };
    expect(manifest).toMatchObject({ schemaVersion: 1, portfolioId: "excalidraw-scene-history-reference-v1" });
    expect(manifest.inputs.map(({ path }) => path)).toEqual([...manifest.inputs.map(({ path }) => path)].sort());
    expect(manifest.inputs).toEqual(await Promise.all(manifest.inputs.map(async ({ path }) => ({
      path,
      digest: `sha256:${createHash("sha256").update(await readFile(join(process.cwd(), path))).digest("hex")}`,
    }))));
    expect(manifest.inputs.map(({ path }) => path)).toEqual(expect.arrayContaining([
      "eval-cases/excalidraw-scene-history/solution/green-functional.patch",
      "eval-cases/excalidraw-scene-history/solution/green-command-log.patch",
      "packages/capability-evals/test/fixtures/excalidraw-scene-history/green-functional.mjs",
      "packages/capability-evals/test/fixtures/excalidraw-scene-history/green-command-log.mjs",
    ]));
  });

  it("applies the exact reproducible declaration-build compatibility seed once", () => {
    const manifest = [
      "{",
      '  "devDependencies": {',
      '    "@types/lodash.throttle": "4.1.7",',
      '    "@types/react-dom": "19.0.4",',
      '    "typescript": "5.7.2"',
      "  }",
      "}",
      "",
    ].join("\n");
    const lock = [
      "# yarn lockfile v1",
      "",
      '"@types/node@*":',
      '  version "22.10.2"',
      "",
      '"@types/semver@^7.3.12":',
      '  version "7.5.8"',
      "",
    ].join("\n");
    const seededManifest = seedExcalidrawCompatibilityManifest(manifest);
    const seededLock = seedExcalidrawCompatibilityLock(lock);
    expect(JSON.parse(seededManifest).devDependencies).toMatchObject({
      "@types/mime-types": "2.1.4",
      "@types/retry": "0.12.5",
    });
    expect(seededLock).toContain('"@types/mime-types@2.1.4"');
    expect(seededLock).toContain('"@types/retry@0.12.5"');
    expect(() => seedExcalidrawCompatibilityManifest(seededManifest)).toThrow("already contains");
    expect(() => seedExcalidrawCompatibilityLock(seededLock)).toThrow("already contains");
  });

  it("materializes the exact seed, installs frozen, and leaves a clean workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-excalidraw-materializer-"));
    temporaryDirectories.push(root);
    const cacheDirectory = join(root, "cache");
    const workspaceDirectory = join(root, "execution", "workspace");
    await writeUpstreamStub(cacheDirectory);
    let committed = false;
    const calls: string[] = [];
    const runCommand: CommandRunner = async (command, args, options) => {
      calls.push(`${command} ${args.join(" ")}`);
      if (command === "git" && args[0] === "clone") await cp(cacheDirectory, workspaceDirectory, { recursive: true });
      if (command === "git" && args.includes("commit")) committed = true;
      if (command === "git" && args[0] === "rev-parse") {
        const parent = args[1] === "HEAD^";
        const tree = args[1] === "HEAD^{tree}";
        return { exitCode: 0, stdout: `${parent ? EXCALIDRAW_UPSTREAM_COMMIT : tree ? (committed && options.cwd === workspaceDirectory ? EXCALIDRAW_SEEDED_TREE : EXCALIDRAW_UPSTREAM_TREE) : (committed && options.cwd === workspaceDirectory ? EXCALIDRAW_SEEDED_COMMIT : EXCALIDRAW_UPSTREAM_COMMIT)}\n`, stderr: "" };
      }
      if (command === "git" && args[0] === "status") return { exitCode: 0, stdout: "", stderr: "" };
      return { exitCode: 0, stdout: "", stderr: "" };
    };

    const receipt = await materializeExcalidrawSceneHistoryFixture({ cacheDirectory, workspaceDirectory, platform: "darwin", nodeVersion: "22.11.0", runCommand });
    expect(receipt).toMatchObject({ seededCommit: EXCALIDRAW_SEEDED_COMMIT, seededTree: EXCALIDRAW_SEEDED_TREE, installedWithFrozenLockfile: true });
    expect(calls).toContain(`corepack ${EXCALIDRAW_PACKAGE_MANAGER} install --frozen-lockfile --ignore-scripts --non-interactive`);
    expect(calls.some((call) => call.includes("commit -m Seed reproducible Excalidraw declaration build"))).toBe(true);
    expect(await readFile(join(workspaceDirectory, "package.json"), "utf8")).toContain('"@types/mime-types": "2.1.4"');
  });

  it("rejects unsupported environments before materialization", async () => {
    const unused: CommandRunner = async () => { throw new Error("must not run"); };
    await expect(materializeExcalidrawSceneHistoryFixture({ cacheDirectory: "/unused", workspaceDirectory: "/unused-workspace", platform: "linux", runCommand: unused })).rejects.toThrow("local Mac only");
    await expect(materializeExcalidrawSceneHistoryFixture({ cacheDirectory: "/unused", workspaceDirectory: "/unused-workspace", platform: "darwin", nodeVersion: "23.0.0", runCommand: unused })).rejects.toThrow("requires Node");
  });
});

describe("Excalidraw sealed verifier admission", () => {
  it("keeps predicates independent and qualifies only from a pristine verifier workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-excalidraw-grade-"));
    temporaryDirectories.push(root);
    const candidate = join(root, "candidate");
    await mkdir(join(candidate, "packages", "excalidraw", "tests"), { recursive: true });
    await writeFile(join(candidate, "packages", "excalidraw", "tests", ".relayer-scene-history.test.tsx"), "throw new Error('candidate-owned forged verifier');\n");
    const verifierDirectories = new Set<string>();
    let assertions: Array<{ title: string; status: string }> = predicateIds.map((title) => ({ title, status: title === "native-assets-appstate" ? "failed" : "passed" }));
    let behaviorExitCode = 1;
    const runCommand: CommandRunner = async (command, args, options) => {
      if (command === "git" && args[0] === "diff") return { exitCode: 0, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "clone") { await cp(candidate, args.at(-1)!, { recursive: true }); return { exitCode: 0, stdout: "", stderr: "" }; }
      if (command === "git" && args[0] === "status") return { exitCode: 0, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "rev-list") return { exitCode: 0, stdout: "candidate-commit\n", stderr: "" };
      if (command === "git") return { exitCode: 0, stdout: "", stderr: "" };
      verifierDirectories.add(options.cwd);
      if (args.includes("--reporter=json")) return { exitCode: behaviorExitCode, stdout: `yarn run v1.22.22\n${JSON.stringify({ testResults: [{ assertionResults: assertions }] })}\nDone in 1.00s.\n`, stderr: "one predicate failed" };
      return { exitCode: 0, stdout: "ok", stderr: "" };
    };
    const checks = await gradeExcalidrawSceneHistoryWorkspace({ workspaceDirectory: candidate, runCommand, qualificationAuthorityVerifier: async () => ({ passed: true, mismatches: [] }) });
    expect(checks.filter(({ name }) => name.includes("scene-history-")).map(({ name }) => name)).toEqual([
      ...predicateIds.map((id) => `workspace:scene-history-${id}`),
      "workspace:scene-history-qualification-authority",
      "workspace:scene-history-build",
      "workspace:scene-history-upstream-tests",
      "workspace:scene-history-commit",
      "workspace:scene-history-clean",
    ]);
    expect(checks.find(({ name }) => name.endsWith("native-assets-appstate"))?.passed).toBe(false);
    expect(checks.filter(({ name }) => predicateIds.some((id) => name.endsWith(id)) && !name.endsWith("native-assets-appstate")).every(({ passed }) => passed)).toBe(true);
    assertions = predicateIds.map((title) => ({ title, status: "passed" }));
    behaviorExitCode = 1;
    const runtimeFailure = await gradeExcalidrawSceneHistoryWorkspace({ workspaceDirectory: candidate, runCommand, qualificationAuthorityVerifier: async () => ({ passed: true, mismatches: [] }) });
    expect(runtimeFailure.filter(({ name }) => predicateIds.some((id) => name.endsWith(id))).every(({ passed }) => !passed)).toBe(true);
    for (const malformed of [
      [...predicateIds.map((title) => ({ title, status: "passed" })), { title: predicateIds[0], status: "passed" }],
      [...predicateIds.map((title) => ({ title, status: "passed" })), { title: "unexpected-native-claim", status: "passed" }],
      predicateIds.slice(1).map((title) => ({ title, status: "passed" })),
    ]) {
      assertions = malformed;
      const rejected = await gradeExcalidrawSceneHistoryWorkspace({ workspaceDirectory: candidate, runCommand, qualificationAuthorityVerifier: async () => ({ passed: true, mismatches: [] }) });
      expect(rejected.filter(({ name }) => predicateIds.some((id) => name.endsWith(id))).every(({ passed }) => !passed)).toBe(true);
    }
    expect([...verifierDirectories].every((directory) => directory !== candidate)).toBe(true);
  });

  it("keeps the seeded-absent yarn redirect as a distinct authority mutant", async () => {
    const patch = await readFile(join(process.cwd(), "eval-cases", "excalidraw-scene-history", "solution", "mutants", "forged-yarnrc.patch"), "utf8");
    expect(patch).toContain("diff --git a/.yarnrc b/.yarnrc");
    expect(patch).toContain('yarn-path "./scripts/emit-forged-pass.mjs"');
    expect(patch).not.toContain("diff --git a/package.json b/package.json");
    expect(EXCALIDRAW_ADMISSION_PORTFOLIO_V1.expectedFailures["mutant-forged-yarnrc"]).toEqual(EXCALIDRAW_ADMISSION_PORTFOLIO_V1.expectedFailures["mutant-forged-runner"]);
  });

  it("rejects a forged qualification runner before install or candidate commands", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-excalidraw-forged-runner-"));
    temporaryDirectories.push(root);
    const candidate = join(root, "candidate");
    await mkdir(candidate, { recursive: true });
    let candidateCommandRan = false;
    const runCommand: CommandRunner = async (command, args, options) => {
      if (command === "git" && args[0] === "diff" && args[1] === "--binary") return { exitCode: 0, stdout: await readFile(join(process.cwd(), "eval-cases", "excalidraw-scene-history", "solution", "mutants", "forged-runner.patch"), "utf8"), stderr: "" };
      if (command === "git" && args[0] === "clone") { await mkdir(args.at(-1)!, { recursive: true }); return { exitCode: 0, stdout: "", stderr: "" }; }
      if (command === "git" && ["checkout", "apply"].includes(args[0]!)) return { exitCode: 0, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "diff" && args[1] === "--exit-code") return { exitCode: 1, stdout: "package.json differs", stderr: "" };
      if (command === "git" && args[0] === "status") return { exitCode: 0, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "rev-list") return { exitCode: 0, stdout: "candidate-commit\n", stderr: "" };
      candidateCommandRan = true;
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const checks = await gradeExcalidrawSceneHistoryWorkspace({ workspaceDirectory: candidate, runCommand, qualificationAuthorityVerifier: async () => ({ passed: false, mismatches: ["package.json"] }) });
    expect(checks.filter(({ passed }) => !passed).map(({ name }) => name)).toEqual([
      ...predicateIds.map((id) => `workspace:scene-history-${id}`),
      "workspace:scene-history-qualification-authority",
      "workspace:scene-history-build",
      "workspace:scene-history-upstream-tests",
    ]);
    expect(checks.find(({ name }) => name === "workspace:scene-history-qualification-authority")?.detail).toContain("package.json");
    expect(candidateCommandRan).toBe(false);
  });

  it("admits two portable designs while preserving the red baseline and targeted mutants", async () => {
    const cases = [
      { id: "untouched", expectation: "red" as const, modulePath: join(fixtureDirectory, "red-untouched.mjs") },
      { id: "green-functional", expectation: "green" as const, modulePath: join(fixtureDirectory, "green-functional.mjs") },
      { id: "green-command-log", expectation: "green" as const, modulePath: join(fixtureDirectory, "green-command-log.mjs") },
      ...["branch-overwrite", "common-ancestor", "silent-lww", "early-resolution", "nondeterminism", "ordering", "bindings", "frame-container", "groups", "assets", "undo", "export", "compat", "history-loss", "forged-verdict"].map((name) => ({
        id: `mutant-${name}`,
        expectation: "mutant" as const,
        modulePath: join(fixtureDirectory, `mutant-${name}.mjs`),
      })),
    ];
    const first = await runExcalidrawPortablePortfolio({ fixtureDirectory, entries: cases });
    const second = await runExcalidrawPortablePortfolio({ fixtureDirectory, entries: cases });
    expect(first.admitted, JSON.stringify(first, null, 2)).toBe(true);
    expect(first.entries.filter(({ expectation }) => expectation === "green")).toHaveLength(2);
    expect(first.entries.map(({ id, expectation, passed, checks }) => ({ id, expectation, passed, checks }))).toEqual(second.entries.map(({ id, expectation, passed, checks }) => ({ id, expectation, passed, checks })));
    expect(first.entries.every(({ checks }) => checks.map(({ id }) => id).join(",") === predicateIds.join(","))).toBe(true);

    const failures = Object.fromEntries(first.entries.map((entry) => [entry.id, new Set(entry.checks.filter(({ passed }) => !passed).map(({ id }) => id))]));
    expect(first.entries.find(({ id }) => id === "green-functional")?.passed).toBe(true);
    expect(first.entries.find(({ id }) => id === "green-command-log")?.passed).toBe(true);
    expect(failures["green-command-log"]).toEqual(new Set(["public-ui", "native-assets-appstate"]));
    expect(failures["green-functional"]).toEqual(new Set(["public-ui", "native-assets-appstate"]));
    expect(failures["mutant-branch-overwrite"]).toContain("historical-branching");
    expect(failures["mutant-common-ancestor"]).toContain("deterministic-merge");
    expect(failures["mutant-silent-lww"]).toContain("conflict-taxonomy");
    expect(failures["mutant-early-resolution"]).toContain("conflict-taxonomy");
    expect(failures["mutant-nondeterminism"]).toContain("deterministic-merge");
    expect(failures["mutant-ordering"]).toContain("deterministic-merge");
    expect(failures["mutant-bindings"]).toContain("relationship-integrity");
    expect(failures["mutant-frame-container"]).toContain("relationship-integrity");
    expect(failures["mutant-groups"]).toContain("groups-and-assets");
    expect(failures["mutant-assets"]).toContain("groups-and-assets");
    expect(failures["mutant-undo"]).toContain("undo-boundary");
    expect(failures["mutant-export"]).toContain("export-boundary");
    expect(failures["mutant-compat"]).toContain("historical-compatibility");
    expect(failures["mutant-history-loss"]).toContain("historical-compatibility");
    expect(failures["mutant-forged-verdict"]?.size).toBeGreaterThan(0);
  });

  it("persists each real-portfolio receipt and retains only unexpected workspaces", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-excalidraw-receipts-"));
    temporaryDirectories.push(root);
    const artifactsDirectory = join(root, "artifacts");
    const runCommand: CommandRunner = async (command, args) => {
      if (command === "git" && args[0] === "rev-parse") return { exitCode: 0, stdout: `${args[1] === "HEAD" ? EXCALIDRAW_SEEDED_COMMIT : args[1] === "HEAD^" ? EXCALIDRAW_UPSTREAM_COMMIT : EXCALIDRAW_SEEDED_TREE}\n`, stderr: "" };
      if (command === "git" && args[0] === "clone") await mkdir(args.at(-1)!, { recursive: true });
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const gradeWorkspace = async () => completeAdmissionChecks(new Set(["workspace:scene-history-public-ui"]));
    const result = await runExcalidrawAdmissionPortfolio({
      fixtureDirectory: join(root, "fixture"),
      artifactsDirectory,
      entries: [
        { id: "unexpected green", expectation: "green", patchPaths: [] },
        { id: "expected mutant", expectation: "mutant", patchPaths: [], expectedFailedChecks: ["workspace:scene-history-public-ui"] },
      ],
      runCommand,
      gradeWorkspace,
    });
    expect(result.entries.map(({ id, passed }) => ({ id, passed }))).toEqual([
      { id: "unexpected green", passed: false },
      { id: "expected mutant", passed: true },
    ]);
    const failedReceipt = JSON.parse(await readFile(join(artifactsDirectory, "receipts", "01-unexpected_green.json"), "utf8"));
    const passedReceipt = JSON.parse(await readFile(join(artifactsDirectory, "receipts", "02-expected_mutant.json"), "utf8"));
    expect(failedReceipt.workspaceDirectory).toContain("01-unexpected_green-");
    await expect(access(failedReceipt.workspaceDirectory)).resolves.toBeUndefined();
    expect(passedReceipt.workspaceDirectory).toBeNull();
  });

  it("does not accept an infrastructure failure as an intended semantic mutant rejection", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-excalidraw-intended-reason-"));
    temporaryDirectories.push(root);
    const runCommand: CommandRunner = async (command, args) => {
      if (command === "git" && args[0] === "rev-parse") return { exitCode: 0, stdout: `${args[1] === "HEAD" ? EXCALIDRAW_SEEDED_COMMIT : args[1] === "HEAD^" ? EXCALIDRAW_UPSTREAM_COMMIT : EXCALIDRAW_SEEDED_TREE}\n`, stderr: "" };
      if (command === "git" && args[0] === "clone") await mkdir(args.at(-1)!, { recursive: true });
      return { exitCode: 0, stdout: "", stderr: "" };
    };
    const result = await runExcalidrawAdmissionPortfolio({
      fixtureDirectory: join(root, "fixture"),
      artifactsDirectory: join(root, "artifacts"),
      entries: [{ id: "semantic mutant", expectation: "mutant", patchPaths: [], expectedFailedChecks: ["workspace:scene-history-conflict-taxonomy"] }],
      runCommand,
      gradeWorkspace: async () => completeAdmissionChecks(new Set(["workspace:scene-history-conflict-taxonomy", "workspace:scene-history-build"])),
    });
    expect(result.admitted).toBe(false);
    expect(result.entries[0]).toMatchObject({ passed: false, verdictDetail: expect.stringContaining("unintended reasons") });
  });

  it("rejects a weakened versioned intended-reason matrix before workspace work", async () => {
    const portfolio = EXCALIDRAW_ADMISSION_PORTFOLIO_V1;
    const expectedFailures = portfolio.expectedFailures as Readonly<Record<string, readonly string[]>>;
    const entries: ExcalidrawPatchAdmissionEntry[] = [
      { id: portfolio.baselineId, expectation: "red" as const, patchPaths: [], expectedFailedChecks: portfolio.expectedFailures[portfolio.baselineId] },
      ...portfolio.greenIds.map((id) => ({ id, expectation: "green" as const, patchPaths: [id] })),
      ...portfolio.mutantIds.map((id) => ({ id, expectation: "mutant" as const, patchPaths: [id], expectedFailedChecks: id === "mutant-branch-overwrite" ? ["workspace:scene-history-historical-branching"] : expectedFailures[id]! })),
    ];
    const runCommand: CommandRunner = async () => { throw new Error("workspace work must not start"); };
    await expect(runExcalidrawAdmissionPortfolio({ fixtureDirectory: "/unused", portfolioId: portfolio.id, entries, runCommand })).rejects.toThrow("exact versioned entry roster");
  });
});

function completeAdmissionChecks(failures: ReadonlySet<string>) {
  return [
    ...predicateIds.map((id) => `workspace:scene-history-${id}`),
    "workspace:scene-history-qualification-authority",
    "workspace:scene-history-build",
    "workspace:scene-history-upstream-tests",
    "workspace:scene-history-commit",
    "workspace:scene-history-clean",
  ].map((name) => ({ name, passed: !failures.has(name), detail: failures.has(name) ? "declared test failure" : "passed" }));
}

async function writeUpstreamStub(directory: string) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, "LICENSE"), "MIT License\nfixture\n");
  await writeFile(join(directory, "package.json"), [
    "{",
    `  \"packageManager\": \"${EXCALIDRAW_PACKAGE_MANAGER}\",`,
    `  \"engines\": { \"node\": \"${EXCALIDRAW_NODE_RANGE}\" },`,
    '  "devDependencies": {',
    '    "@types/lodash.throttle": "4.1.7",',
    '    "@types/react-dom": "19.0.4",',
    '    "typescript": "5.7.2"',
    "  }",
    "}",
    "",
  ].join("\n"));
  await writeFile(join(directory, "yarn.lock"), '# yarn lockfile v1\n\n"@types/node@*":\n  version "22.10.2"\n\n"@types/semver@^7.3.12":\n  version "7.5.8"\n');
}
