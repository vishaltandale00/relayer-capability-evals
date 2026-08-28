import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  EXCALIDRAW_NODE_RANGE,
  EXCALIDRAW_PACKAGE_MANAGER,
  EXCALIDRAW_SCENE_HISTORY_CASE_ID,
  EXCALIDRAW_SEEDED_COMMIT,
  EXCALIDRAW_SEEDED_TREE,
  EXCALIDRAW_UPSTREAM_COMMIT,
  EXCALIDRAW_UPSTREAM_TREE,
  excalidrawSceneHistoryCase,
  excalidrawVerifierDigest,
  gradeExcalidrawSceneHistoryWorkspace,
  materializeExcalidrawSceneHistoryFixture,
  runExcalidrawPortablePortfolio,
  seedExcalidrawCompatibilityLock,
  seedExcalidrawCompatibilityManifest,
} from "../src/project-cases/excalidraw-scene-history.js";
import type { CommandRunner } from "../src/project-cases/h3.js";

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
  "export-boundary",
  "historical-compatibility",
] as const;

afterEach(async () => {
  for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});

describe("Excalidraw scene-history immutable case", () => {
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
    const assertions = predicateIds.map((title) => ({ title, status: title === "groups-and-assets" ? "failed" : "passed" }));
    const runCommand: CommandRunner = async (command, args, options) => {
      if (command === "git" && args[0] === "diff") return { exitCode: 0, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "clone") { await cp(candidate, args.at(-1)!, { recursive: true }); return { exitCode: 0, stdout: "", stderr: "" }; }
      if (command === "git" && args[0] === "status") return { exitCode: 0, stdout: "", stderr: "" };
      if (command === "git" && args[0] === "rev-list") return { exitCode: 0, stdout: "candidate-commit\n", stderr: "" };
      if (command === "git") return { exitCode: 0, stdout: "", stderr: "" };
      verifierDirectories.add(options.cwd);
      if (args.includes("--reporter=json")) return { exitCode: 1, stdout: JSON.stringify({ testResults: [{ assertionResults: assertions }] }), stderr: "one predicate failed" };
      return { exitCode: 0, stdout: "ok", stderr: "" };
    };
    const checks = await gradeExcalidrawSceneHistoryWorkspace({ workspaceDirectory: candidate, runCommand });
    expect(checks.filter(({ name }) => name.includes("scene-history-")).map(({ name }) => name)).toEqual([
      ...predicateIds.map((id) => `workspace:scene-history-${id}`),
      "workspace:scene-history-build",
      "workspace:scene-history-upstream-tests",
      "workspace:scene-history-commit",
      "workspace:scene-history-clean",
    ]);
    expect(checks.find(({ name }) => name.endsWith("groups-and-assets"))?.passed).toBe(false);
    expect(checks.filter(({ name }) => predicateIds.some((id) => name.endsWith(id)) && !name.endsWith("groups-and-assets")).every(({ passed }) => passed)).toBe(true);
    expect([...verifierDirectories].every((directory) => directory !== candidate)).toBe(true);
  });

  it("proves untouched red, two distinct greens, targeted mutants, and deterministic boundary evidence", async () => {
    const cases = [
      { id: "untouched", expectation: "red" as const, modulePath: join(fixtureDirectory, "red-untouched.mjs") },
      { id: "green-functional", expectation: "green" as const, modulePath: join(fixtureDirectory, "green-functional.mjs") },
      { id: "green-command-log", expectation: "green" as const, modulePath: join(fixtureDirectory, "green-command-log.mjs") },
      ...["ui-accessibility", "branch-overwrite", "common-ancestor", "silent-lww", "early-resolution", "nondeterminism", "ordering", "bindings", "frame-container", "groups", "assets", "undo", "export", "compat", "history-loss", "forged-verdict"].map((name) => ({
        id: `mutant-${name}`,
        expectation: "mutant" as const,
        modulePath: join(fixtureDirectory, `mutant-${name}.mjs`),
      })),
    ];
    const first = await runExcalidrawPortablePortfolio({ fixtureDirectory, entries: cases });
    const second = await runExcalidrawPortablePortfolio({ fixtureDirectory, entries: cases });
    expect(first.admitted, JSON.stringify(first, null, 2)).toBe(true);
    expect(first.entries.every(({ passed }) => passed), JSON.stringify(first, null, 2)).toBe(true);
    expect(first.entries.filter(({ expectation }) => expectation === "green")).toHaveLength(2);
    expect(first.entries.map(({ id, expectation, passed, checks }) => ({ id, expectation, passed, checks }))).toEqual(second.entries.map(({ id, expectation, passed, checks }) => ({ id, expectation, passed, checks })));
    expect(first.entries.every(({ checks }) => checks.map(({ id }) => id).join(",") === predicateIds.join(","))).toBe(true);

    const failures = Object.fromEntries(first.entries.map((entry) => [entry.id, new Set(entry.checks.filter(({ passed }) => !passed).map(({ id }) => id))]));
    expect(failures["mutant-ui-accessibility"]).toContain("public-ui");
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
});

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
