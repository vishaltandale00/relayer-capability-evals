import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

import { bindAutonomousCaseSnapshot } from "../cases/catalog.js";
import { createAutonomousCaseSnapshot } from "../cases/contracts.js";
import type { EvalCheck } from "../runtime-basic.js";
import type { CommandResult, CommandRunner, ProjectEvalCaseDefinition } from "./h3.js";

export const EXCALIDRAW_SCENE_HISTORY_CASE_ID = "autonomous.excalidraw.scene-history";
export const EXCALIDRAW_REPOSITORY_URL = "https://github.com/excalidraw/excalidraw.git";
export const EXCALIDRAW_UPSTREAM_COMMIT = "a2ec2889babf7d2295469c6d90ebe77fae57df84";
export const EXCALIDRAW_UPSTREAM_TREE = "d3311e5625898710e0479761bcff509a2e4e6ee9";
export const EXCALIDRAW_SEEDED_COMMIT = "c52dec55d5ee55d0b7ab4490c0ae2ea972677a04";
export const EXCALIDRAW_SEEDED_TREE = "c012bac05bc9ff960878600eca11a39eda226037";
export const EXCALIDRAW_PACKAGE_MANAGER = "yarn@1.22.22";
export const EXCALIDRAW_NODE_RANGE = "18.0.0 - 22.x.x";
export const EXCALIDRAW_SEED_MESSAGE = "Seed reproducible Excalidraw declaration build";
export const EXCALIDRAW_EXPECTED_RUNTIME_SECONDS = Object.freeze({ install: 120, packageBuild: 30, focusedTests: 60 });

const VERIFIER_CHECKS = Object.freeze([
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
]);

const TASK = `Add branching scene history to Excalidraw as a substantial user-visible feature. Export a public opaque controller through @excalidraw/excalidraw, plus an accessible SceneHistoryPanel({ controller }) with a labelled Scene history region and controls named Save version, Checkout version, Merge versions, Resolve conflicts, and Export history. The controller must expose createSceneHistoryController(initialScene), importSceneHistory(serialized), listVersions(), saveVersion({ name, parentVersionId, scene }), checkout(versionId), mergeVersions({ name, baseVersionId, versionIds, resolutions? }), resolveMerge(mergeId, resolutions), getCurrentScene(), exportHistory(), exportCurrentScene(), undo(), and redo(). listVersions() and saveVersion() return versions shaped { id, name, parentIds }; checkout() and getCurrentScene() return scene snapshots. A successful merge returns { status: "merged", version, scene }; an unresolved merge returns { status: "conflicts", mergeId, conflicts }, where each stable conflict is { id, kind, path, base, left, right }. resolutions is an object keyed by every conflict ID with "left", "right", or an explicit replacement value. exportHistory() and exportCurrentScene() return serialized JSON.

Version names are non-empty after NFC normalization, case-sensitive, and unique. Versions are immutable, have stable IDs, and store explicit parent IDs. Saving from history creates a branch without rewriting descendants or siblings. Merge takes an explicit common-ancestor base and two unordered parents. It performs deterministic three-way merge by element ID and JSON field path, treating arrays atomically; one-sided and identical edits merge automatically. Same-field divergence, modify/delete, divergent same-ID additions, and byte-different same-ID assets surface stable conflicts, and no merge version may exist until all conflicts are resolved. Element order is Excalidraw fractional index then ID; version, versionNonce, and updated are revision metadata rather than semantic conflicts. Bindings, groups, frames, containers, and assets are integrity-coupled and may not be silently dropped or repaired.

Versions contain elements, files, and export-safe document app state, excluding transient selection/tool state. Checkout and completed merge each apply as one ordinary undo step; undo changes the displayed scene, never the immutable version graph. Ordinary .excalidraw export remains current-scene-only. A separate schema-v1 history export contains the complete graph, snapshots, and assets. Import ordinary Excalidraw v1/v2 documents through upstream restoration while preserving unknown element fields; reject unsupported future history schemas. Add focused tests, run the bounded package build and relevant history/restore/export tests, and create at least one meaningful local commit. Do not push or publish.`;

const fixture = Object.freeze({
  repositoryUrl: EXCALIDRAW_REPOSITORY_URL,
  upstreamCommit: EXCALIDRAW_UPSTREAM_COMMIT,
  upstreamTree: EXCALIDRAW_UPSTREAM_TREE,
  seededCommit: EXCALIDRAW_SEEDED_COMMIT,
  seededTree: EXCALIDRAW_SEEDED_TREE,
  packageManager: EXCALIDRAW_PACKAGE_MANAGER,
  node: EXCALIDRAW_NODE_RANGE,
  license: "MIT" as const,
  expectedRuntimeSeconds: EXCALIDRAW_EXPECTED_RUNTIME_SECONDS,
});

const definition = Object.freeze({
  schemaVersion: 1,
  id: EXCALIDRAW_SCENE_HISTORY_CASE_ID,
  name: "Excalidraw · branching scene history",
  description: "Adds immutable named scene versions, historical branching, deterministic merge, surfaced conflicts, and durable history export to a frozen Excalidraw repository.",
  localOnly: true,
  supportedPlatform: "darwin",
  autonomous: true,
  category: "coding",
  taskType: "feature-change",
  fixture,
  threads: Object.freeze([Object.freeze({
    id: "implementation",
    name: "Build branching scene history",
    permissionProfileId: "full",
    mutationPolicy: "writable",
    workspaceGrade: "autonomous-implementation",
    prompts: Object.freeze([TASK]),
  })]),
}) satisfies Omit<ProjectEvalCaseDefinition, "fixture"> & { readonly fixture: typeof fixture };

const digest = (value: string) => `sha256:${createHash("sha256").update(value).digest("hex")}` as const;

export function excalidrawVerifierDigest(): `sha256:${string}` {
  return digest([
    gradeExcalidrawSceneHistoryWorkspace.toString(),
    withPristineVerifierWorkspace.toString(),
    hiddenVerifierSource(),
    parseBehaviorChecks.toString(),
    runExcalidrawAdmissionPortfolio.toString(),
    JSON.stringify(VERIFIER_CHECKS),
  ].join("\n"));
}

const criteria = Object.freeze([
  { id: "history-correctness", label: "History correctness", description: "Named versions, branching, merge, conflicts, integrity, undo, and export follow the v1 contract.", weight: 4 },
  { id: "user-experience", label: "Usable scene history", description: "The feature is accessible and integrated into Excalidraw without regressing ordinary editing and export.", weight: 1 },
]);

export const excalidrawSceneHistoryCase = bindAutonomousCaseSnapshot(
  definition,
  createAutonomousCaseSnapshot({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    category: "coding",
    taskType: "feature-change",
    artifacts: {
      task: { kind: "visible-task", text: TASK, contentDigest: digest(TASK) },
      workspace: {
        kind: "frozen-workspace",
        materializerId: "excalidraw-scene-history-seeded-v1",
        source: EXCALIDRAW_REPOSITORY_URL,
        revision: `git-tree:${EXCALIDRAW_SEEDED_TREE}`,
        contentDigest: digest(`${EXCALIDRAW_REPOSITORY_URL}\n${EXCALIDRAW_UPSTREAM_COMMIT}\n${EXCALIDRAW_UPSTREAM_TREE}\n${EXCALIDRAW_SEEDED_COMMIT}\n${EXCALIDRAW_SEEDED_TREE}`),
        environmentDigest: digest(JSON.stringify({ packageManager: EXCALIDRAW_PACKAGE_MANAGER, node: EXCALIDRAW_NODE_RANGE, install: ["install", "--frozen-lockfile", "--ignore-scripts"], expectedRuntimeSeconds: EXCALIDRAW_EXPECTED_RUNTIME_SECONDS })),
      },
      reference: {
        kind: "sealed-reference",
        artifactId: "excalidraw-scene-history-reference-v1",
        format: "admission-portfolio",
        contentDigest: "sha256:9ce7a34d8370b51cb6418b467a050f8dd6e28120f74548ab2608eef14f4cc2e9",
        sealedPath: "eval-cases/excalidraw-scene-history/solution/reference.md",
      },
      verifier: {
        kind: "sealed-verifier",
        artifactId: "excalidraw-scene-history-verifier-v1",
        verifierId: "excalidraw-scene-history-v1",
        contentDigest: excalidrawVerifierDigest(),
        sealedPath: "packages/eval-runner/src/project-cases/excalidraw-scene-history.ts",
        mandatoryGates: [
          { id: "scene-history-behavior", label: "Scene-history behavior", description: "Independent black-box predicates cover the complete approved scene-history contract." },
          { id: "scene-history-regression", label: "Excalidraw regression safety", description: "The bounded package build and upstream history, restore, and export tests pass." },
          { id: "scene-history-delivery", label: "Committed clean delivery", description: "The feature is committed and the candidate workspace is clean." },
        ],
      },
      outcomeRubric: {
        kind: "outcome-rubric",
        rubricVersion: "excalidraw-scene-history-outcome-v1",
        contentDigest: digest(JSON.stringify(criteria)),
        criteria,
      },
    },
  }),
);

export function seedExcalidrawCompatibilityManifest(source: string): string {
  if (source.includes('"@types/mime-types"') || source.includes('"@types/retry"')) {
    throw new Error("Pinned Excalidraw manifest already contains the compatibility dependencies.");
  }
  const withMime = replaceOnce(source, '    "@types/lodash.throttle": "4.1.7",\n', '    "@types/lodash.throttle": "4.1.7",\n    "@types/mime-types": "2.1.4",\n');
  return replaceOnce(withMime, '    "@types/react-dom": "19.0.4",\n', '    "@types/react-dom": "19.0.4",\n    "@types/retry": "0.12.5",\n');
}

export function seedExcalidrawCompatibilityLock(source: string): string {
  if (source.includes('"@types/mime-types@2.1.4"') || source.includes('"@types/retry@0.12.5"')) {
    throw new Error("Pinned Excalidraw lockfile already contains the compatibility dependencies.");
  }
  const mime = `"@types/mime-types@2.1.4":\n  version "2.1.4"\n  resolved "https://registry.yarnpkg.com/@types/mime-types/-/mime-types-2.1.4.tgz#93a1933e24fed4fb9e4adc5963a63efcbb3317a2"\n  integrity sha512-lfU4b34HOri+kAY5UheuFMWPDOI+OPceBSHZKp69gEyTL/mmJ4cnU6Y/rlme3UL3GyOn6Y42hyIEw0/q8sWx5w==\n\n`;
  const retry = `"@types/retry@0.12.5":\n  version "0.12.5"\n  resolved "https://registry.yarnpkg.com/@types/retry/-/retry-0.12.5.tgz#f090ff4bd8d2e5b940ff270ab39fd5ca1834a07e"\n  integrity sha512-3xSjTp3v03X/lSQLkczaN9UIEwJMoMCA1+Nb5HfbJEQWogdeQIyVtTvxPXDQjZ5zws8rFQfVfRdz03ARihPJgw==\n\n`;
  const withMime = replaceOnce(source, '"@types/node@*":\n', `${mime}"@types/node@*":\n`);
  return replaceOnce(withMime, '"@types/semver@^7.3.12":\n', `${retry}"@types/semver@^7.3.12":\n`);
}

export interface ExcalidrawFixtureReceipt {
  readonly schemaVersion: 1;
  readonly fixtureId: typeof EXCALIDRAW_SCENE_HISTORY_CASE_ID;
  readonly workspaceDirectory: string;
  readonly repositoryUrl: typeof EXCALIDRAW_REPOSITORY_URL;
  readonly sourceRevision: `git-tree:${typeof EXCALIDRAW_SEEDED_TREE}`;
  readonly upstreamCommit: typeof EXCALIDRAW_UPSTREAM_COMMIT;
  readonly upstreamTree: typeof EXCALIDRAW_UPSTREAM_TREE;
  readonly seededCommit: typeof EXCALIDRAW_SEEDED_COMMIT;
  readonly seededTree: typeof EXCALIDRAW_SEEDED_TREE;
  readonly packageManager: typeof EXCALIDRAW_PACKAGE_MANAGER;
  readonly installedWithFrozenLockfile: true;
}

export async function materializeExcalidrawSceneHistoryFixture(options: {
  readonly cacheDirectory: string;
  readonly workspaceDirectory: string;
  readonly platform?: NodeJS.Platform;
  readonly nodeVersion?: string;
  readonly runCommand?: CommandRunner;
}): Promise<ExcalidrawFixtureReceipt> {
  if ((options.platform ?? process.platform) !== "darwin") throw new Error("The Excalidraw scene-history case is local Mac only.");
  assertSupportedNode(options.nodeVersion ?? process.versions.node);
  const runCommand = options.runCommand ?? run;
  await ensureCache(options.cacheDirectory, runCommand);
  await requireMissing(options.workspaceDirectory, "Excalidraw execution workspace");
  await mkdir(dirname(options.workspaceDirectory), { recursive: true, mode: 0o700 });
  await required(runCommand, "git", ["clone", "--local", "--no-hardlinks", "--no-checkout", options.cacheDirectory, options.workspaceDirectory], dirname(options.workspaceDirectory));
  await required(runCommand, "git", ["checkout", "--detach", EXCALIDRAW_UPSTREAM_COMMIT], options.workspaceDirectory);
  await verifyUpstream(options.workspaceDirectory, runCommand);
  await seedCompatibility(options.workspaceDirectory);
  await required(runCommand, "git", ["add", "package.json", "yarn.lock"], options.workspaceDirectory);
  await required(runCommand, "git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-m", EXCALIDRAW_SEED_MESSAGE], options.workspaceDirectory, fixtureCommitEnvironment());
  await verifySeeded(options.workspaceDirectory, runCommand);
  await required(runCommand, "corepack", [EXCALIDRAW_PACKAGE_MANAGER, "install", "--frozen-lockfile", "--ignore-scripts", "--non-interactive"], options.workspaceDirectory, { HUSKY: "0" });
  const status = await required(runCommand, "git", ["status", "--porcelain=v1", "--untracked-files=all"], options.workspaceDirectory);
  if (status.stdout.trim()) throw new Error(`Frozen Excalidraw install changed the workspace: ${status.stdout.trim()}`);
  return {
    schemaVersion: 1,
    fixtureId: EXCALIDRAW_SCENE_HISTORY_CASE_ID,
    workspaceDirectory: options.workspaceDirectory,
    repositoryUrl: EXCALIDRAW_REPOSITORY_URL,
    sourceRevision: `git-tree:${EXCALIDRAW_SEEDED_TREE}`,
    upstreamCommit: EXCALIDRAW_UPSTREAM_COMMIT,
    upstreamTree: EXCALIDRAW_UPSTREAM_TREE,
    seededCommit: EXCALIDRAW_SEEDED_COMMIT,
    seededTree: EXCALIDRAW_SEEDED_TREE,
    packageManager: EXCALIDRAW_PACKAGE_MANAGER,
    installedWithFrozenLockfile: true,
  };
}

export async function gradeExcalidrawSceneHistoryWorkspace(options: {
  readonly workspaceDirectory: string;
  readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]> {
  const runCommand = options.runCommand ?? run;
  const verified = await withPristineVerifierWorkspace(options.workspaceDirectory, runCommand, async (directory) => {
    const hiddenPath = join(directory, "packages", "excalidraw", "tests", ".relayer-scene-history.test.tsx");
    await writeFile(hiddenPath, hiddenVerifierSource(), "utf8");
    try {
      const behavior = await runCommand("corepack", [EXCALIDRAW_PACKAGE_MANAGER, "test:app", "--watch=false", "packages/excalidraw/tests/.relayer-scene-history.test.tsx", "--reporter=json"], { cwd: directory });
      const build = await runCommand("corepack", [EXCALIDRAW_PACKAGE_MANAGER, "build:package"], { cwd: directory });
      const regression = await runCommand("corepack", [EXCALIDRAW_PACKAGE_MANAGER, "test:app", "--watch=false", "packages/excalidraw/tests/history.test.tsx", "packages/excalidraw/tests/data/restore.test.ts", "packages/excalidraw/tests/export.test.tsx", "packages/excalidraw/tests/scene/export.test.ts", "--reporter=dot"], { cwd: directory });
      return { behavior, build, regression };
    } finally {
      await rm(hiddenPath, { force: true });
    }
  });
  const behaviorChecks = parseBehaviorChecks(verified.behavior);
  const status = (await required(runCommand, "git", ["status", "--porcelain=v1", "--untracked-files=all"], options.workspaceDirectory)).stdout.trim();
  const commits = lines((await required(runCommand, "git", ["rev-list", `${EXCALIDRAW_SEEDED_COMMIT}..HEAD`], options.workspaceDirectory)).stdout);
  return [
    ...VERIFIER_CHECKS.map((id) => ({
      name: `workspace:scene-history-${id}`,
      passed: behaviorChecks.get(id) === true,
      detail: behaviorChecks.has(id) ? `Sealed public-seam predicate ${id}: ${behaviorChecks.get(id) ? "passed" : "failed"}.` : commandDetail(`sealed predicate ${id}`, verified.behavior),
    })),
    { name: "workspace:scene-history-build", passed: verified.build.exitCode === 0, detail: commandDetail("Excalidraw package build", verified.build) },
    { name: "workspace:scene-history-upstream-tests", passed: verified.regression.exitCode === 0, detail: commandDetail("focused upstream history/restore/export tests", verified.regression) },
    { name: "workspace:scene-history-commit", passed: commits.length >= 1, detail: `${commits.length} post-fixture commit(s).` },
    { name: "workspace:scene-history-clean", passed: status === "", detail: status === "" ? "The candidate workspace is clean." : `Uncommitted changes remain: ${status}` },
  ];
}

export interface PortableAdmissionPortfolioEntry {
  readonly id: string;
  readonly expectation: "red" | "green" | "mutant";
  readonly modulePath?: string;
}

export async function runExcalidrawPortablePortfolio(options: {
  readonly fixtureDirectory: string;
  readonly entries: readonly PortableAdmissionPortfolioEntry[];
}) {
  const results = [];
  for (const entry of options.entries) {
    const modulePath = entry.modulePath;
    if (!modulePath) {
      results.push({ id: entry.id, expectation: entry.expectation, passed: false, checks: VERIFIER_CHECKS.map((id) => ({ id, passed: false })) });
      continue;
    }
    const imported = await import(`${pathToFileURL(modulePath).href}?portfolio=${randomUUID()}`) as PortableSceneHistoryModule;
    const checks = evaluatePortableContract(imported);
    const green = checks.every((check) => check.passed);
    const expected = entry.expectation === "green" ? green : !green;
    results.push({ id: entry.id, expectation: entry.expectation, passed: expected, checks });
  }
  return { admitted: results.length >= 3 && results.every((entry) => entry.passed) && results.filter((entry) => entry.expectation === "green").length >= 2, entries: results };
}

export interface ExcalidrawPatchAdmissionEntry {
  readonly id: string;
  readonly expectation: "red" | "green" | "mutant";
  readonly patchPaths: readonly string[];
}

export async function runExcalidrawAdmissionPortfolio(options: {
  readonly fixtureDirectory: string;
  readonly entries: readonly ExcalidrawPatchAdmissionEntry[];
  readonly runCommand?: CommandRunner;
  readonly gradeWorkspace?: typeof gradeExcalidrawSceneHistoryWorkspace;
}) {
  const runCommand = options.runCommand ?? run;
  const gradeWorkspace = options.gradeWorkspace ?? gradeExcalidrawSceneHistoryWorkspace;
  await verifySeeded(options.fixtureDirectory, runCommand);
  const results = [];
  for (const entry of options.entries) {
    const temporary = await mkdtemp(join(tmpdir(), "relayer-excalidraw-admission-"));
    const workspaceDirectory = join(temporary, "workspace");
    try {
      await required(runCommand, "git", ["clone", "--local", "--no-hardlinks", "--no-checkout", options.fixtureDirectory, workspaceDirectory], temporary);
      await required(runCommand, "git", ["checkout", "--detach", EXCALIDRAW_SEEDED_COMMIT], workspaceDirectory);
      for (const patchPath of entry.patchPaths) await required(runCommand, "git", ["apply", "--whitespace=nowarn", patchPath], workspaceDirectory);
      if (entry.patchPaths.length > 0) {
        await required(runCommand, "git", ["add", "--all"], workspaceDirectory);
        await required(runCommand, "git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-m", `Admission fixture: ${entry.id}`], workspaceDirectory, fixtureCommitEnvironment());
      }
      const checks = await gradeWorkspace({ workspaceDirectory, runCommand });
      const green = checks.every((check) => check.passed);
      results.push({ id: entry.id, expectation: entry.expectation, passed: entry.expectation === "green" ? green : !green, checks });
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  return {
    admitted: results.length >= 3 && results.every((entry) => entry.passed) && results.filter((entry) => entry.expectation === "green").length >= 2,
    entries: results,
  };
}

interface PortableSceneHistoryModule {
  readonly createSceneHistoryController?: (scene: any) => any;
  readonly SceneHistoryPanel?: unknown;
  readonly importSceneHistory?: (value: string) => any;
}

function evaluatePortableContract(module: PortableSceneHistoryModule, inspectPortableUi = true) {
  const checks = VERIFIER_CHECKS.map((id) => ({ id, passed: false }));
  const set = (id: string, passed: boolean) => { const found = checks.find((check) => check.id === id); if (found) found.passed = passed; };
  const test = (id: string, predicate: () => boolean) => { try { set(id, predicate() === true); } catch { set(id, false); } };
  test("public-ui", () => {
    if (typeof module.createSceneHistoryController !== "function" || typeof module.SceneHistoryPanel !== "function" || typeof module.importSceneHistory !== "function") return false;
    if (!inspectPortableUi) return true;
    const controller = module.createSceneHistoryController(scene([]));
    const root = (module.SceneHistoryPanel as (props: { controller: any }) => any)({ controller });
    const nodes: any[] = [root];
    let region = false;
    const buttons = new Set<string>();
    while (nodes.length) {
      const node = nodes.shift();
      if (node === null || node === undefined || typeof node === "boolean") continue;
      if (Array.isArray(node)) { nodes.push(...node); continue; }
      if (typeof node !== "object") continue;
      const props = node.props ?? node;
      const label = String(props["aria-label"] ?? props.ariaLabel ?? "");
      if (props.role === "region" && /scene history/i.test(label)) region = true;
      if ((node.type === "button" || props.role === "button") && typeof props.children === "string") buttons.add(props.children);
      if (props.children !== undefined) nodes.push(props.children);
    }
    return region && ["Save version", "Checkout version", "Merge versions", "Resolve conflicts", "Export history"].every((name) => buttons.has(name));
  });
  test("named-immutable-versions", () => {
    const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [], version: 1 }]);
    const controller = module.createSceneHistoryController!(base);
    const root = controller.saveVersion({ name: "Base", parentVersionId: null, scene: base });
    const leftScene = scene([{ id: "a", x: 10, y: 0, index: "a0", groupIds: [], version: 2 }]);
    controller.saveVersion({ name: "Left", parentVersionId: root.id, scene: leftScene });
    const before = stableScene(controller.listVersions());
    const mutableCheckout = controller.checkout(root.id);
    mutableCheckout.elements[0].x = 999;
    controller.checkout(root.id);
    let emptyRejected = false;
    let equivalentRejected = false;
    try { controller.saveVersion({ name: "   ", parentVersionId: root.id, scene: base }); } catch { emptyRejected = true; }
    const accented = controller.saveVersion({ name: "\u00e9", parentVersionId: root.id, scene: base });
    try { controller.saveVersion({ name: "e\u0301", parentVersionId: root.id, scene: base }); } catch { equivalentRejected = true; }
    const caseDistinct = controller.saveVersion({ name: "\u00c9", parentVersionId: root.id, scene: base });
    return controller.getCurrentScene().elements[0].x === 0
      && stableScene(controller.listVersions().slice(0, 2)) === before
      && emptyRejected && equivalentRejected
      && accented.name === "\u00e9" && caseDistinct.name === "\u00c9";
  });
  test("historical-branching", () => {
    const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [] }]);
    const controller = module.createSceneHistoryController!(base);
    const root = controller.saveVersion({ name: "Base", parentVersionId: null, scene: base });
    const left = controller.saveVersion({ name: "Left", parentVersionId: root.id, scene: scene([{ ...base.elements[0], x: 10 }]) });
    const right = controller.saveVersion({ name: "Right", parentVersionId: root.id, scene: scene([{ ...base.elements[0], y: 20 }]) });
    const versions = controller.listVersions();
    return left.parentIds?.[0] === root.id && right.parentIds?.[0] === root.id && versions.length === 3
      && versions.some((version: any) => version.id === left.id) && versions.some((version: any) => version.id === right.id);
  });
  test("deterministic-merge", () => {
    const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [], version: 1 }]);
    const controller = module.createSceneHistoryController!(base);
    const root = controller.saveVersion({ name: "Base", parentVersionId: null, scene: base });
    const leftScene = scene([{ id: "a", x: 10, y: 0, index: "a0", groupIds: [], fillColor: "red", version: 2 }, { id: "z", x: 0, index: "a1", groupIds: [] }]);
    const rightScene = scene([{ id: "a", x: 0, y: 20, index: "a0", groupIds: [], fillColor: "red", version: 3 }, { id: "b", x: 0, index: "a1", groupIds: [] }]);
    const left = controller.saveVersion({ name: "Left", parentVersionId: root.id, scene: leftScene });
    const right = controller.saveVersion({ name: "Right", parentVersionId: root.id, scene: rightScene });
    const mergedA = controller.mergeVersions({ name: "Merged", baseVersionId: root.id, versionIds: [left.id, right.id] });
    const other = module.createSceneHistoryController!(base);
    const oroot = other.saveVersion({ name: "Base", parentVersionId: null, scene: base });
    const oright = other.saveVersion({ name: "Right", parentVersionId: oroot.id, scene: rightScene });
    const oleft = other.saveVersion({ name: "Left", parentVersionId: oroot.id, scene: leftScene });
    const mergedB = other.mergeVersions({ name: "Merged", baseVersionId: oroot.id, versionIds: [oright.id, oleft.id] });
    let invalidBaseRejected = false;
    try { other.mergeVersions({ name: "Invalid base", baseVersionId: oleft.id, versionIds: [oleft.id, oright.id] }); } catch { invalidBaseRejected = true; }
    return stableScene(mergedA.scene) === stableScene(mergedB.scene)
      && mergedA.scene.elements[0].x === 10
      && mergedA.scene.elements[0].y === 20
      && mergedA.scene.elements[0].fillColor === "red"
      && mergedA.scene.elements.map((element: any) => element.id).join(",") === "a,b,z"
      && mergedA.version?.id === mergedB.version?.id
      && stableScene(mergedA.version?.parentIds ?? mergedA.version?.parents) === stableScene(mergedB.version?.parentIds ?? mergedB.version?.parents)
      && invalidBaseRejected;
  });
  test("conflict-taxonomy", () => {
    const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [] }]);
    const conflictBase = module.createSceneHistoryController!(base);
    const cb = conflictBase.saveVersion({ name: "B", parentVersionId: null, scene: base });
    const c1 = conflictBase.saveVersion({ name: "C1", parentVersionId: cb.id, scene: scene([{ ...base.elements[0], x: 1 }]) });
    const c2 = conflictBase.saveVersion({ name: "C2", parentVersionId: cb.id, scene: scene([{ ...base.elements[0], x: 2 }]) });
    const before = conflictBase.listVersions().length;
    const conflict = conflictBase.mergeVersions({ name: "Conflict", baseVersionId: cb.id, versionIds: [c1.id, c2.id] });
    const swappedConflict = conflictBase.mergeVersions({ name: "Conflict", baseVersionId: cb.id, versionIds: [c2.id, c1.id] });
    const noVersionBeforeResolution = conflictBase.listVersions().length === before;
    const conflictCase = (caseBase: any, leftScene: any, rightScene: any, prefix: string) => {
      const subject = module.createSceneHistoryController!(caseBase);
      const root = subject.saveVersion({ name: `${prefix} base`, parentVersionId: null, scene: caseBase });
      const left = subject.saveVersion({ name: `${prefix} left`, parentVersionId: root.id, scene: leftScene });
      const right = subject.saveVersion({ name: `${prefix} right`, parentVersionId: root.id, scene: rightScene });
      const count = subject.listVersions().length;
      const result = subject.mergeVersions({ name: `${prefix} merge`, baseVersionId: root.id, versionIds: [left.id, right.id] });
      return Array.isArray(result.conflicts) && result.conflicts.length > 0 && subject.listVersions().length === count ? result.conflicts : [];
    };
    const modifyDelete = conflictCase(base, scene([{ ...base.elements[0], x: 9 }]), scene([]), "modify-delete");
    const empty = scene([]);
    const divergentAdd = conflictCase(empty, scene([{ id: "new", x: 1, index: "a0", groupIds: [] }]), scene([{ id: "new", x: 2, index: "a0", groupIds: [] }]), "same-id-add");
    const assetBase = scene([{ id: "img", type: "image", fileId: "f", index: "a0", groupIds: [] }], { f: { id: "f", dataURL: "data:image/png;base64,AA==" } });
    const assetLeft = scene(assetBase.elements, { f: { id: "f", dataURL: "data:image/png;base64,BB==" } });
    const assetRight = scene(assetBase.elements, { f: { id: "f", dataURL: "data:image/png;base64,CC==" } });
    const assetConflict = conflictCase(assetBase, assetLeft, assetRight, "asset");
    const arrayBase = scene([{ id: "array", index: "a0", groupIds: [] }]);
    const arrayConflict = conflictCase(arrayBase, scene([{ ...arrayBase.elements[0], groupIds: ["left"] }]), scene([{ ...arrayBase.elements[0], groupIds: ["right"] }]), "array");
    let partialRejected = false;
    try { conflictBase.resolveMerge(conflict.mergeId, {}); } catch { partialRejected = true; }
    const resolved = conflictBase.resolveMerge(conflict.mergeId, Object.fromEntries(conflict.conflicts.map((item: any) => [item.id, "left"])));
    return Array.isArray(conflict.conflicts)
      && conflict.conflicts.length > 0
      && noVersionBeforeResolution
      && conflict.mergeId === swappedConflict.mergeId
      && stableScene(conflict.conflicts.map((item: any) => item.id)) === stableScene(swappedConflict.conflicts?.map((item: any) => item.id))
      && modifyDelete.some((item: any) => item.kind === "modify-delete" || String(item.path).includes("/elements/a"))
      && divergentAdd.some((item: any) => String(item.path).includes("/elements/new"))
      && assetConflict.some((item: any) => String(item.path).includes("/files/f"))
      && arrayConflict.some((item: any) => String(item.path).includes("/groupIds"))
      && partialRejected && resolved.status === "merged" && conflictBase.listVersions().length === before + 1;
  });
  const relationCheck = (kind: "relationship" | "assets") => {
    const relationScene = scene([
      { id: "box", type: "rectangle", index: "a0", groupIds: ["g"], boundElements: [{ id: "arrow", type: "arrow" }] },
      { id: "arrow", type: "arrow", index: "a1", groupIds: ["g"], startBinding: { elementId: "box" }, endBinding: null },
      { id: "img", type: "image", index: "a2", groupIds: [], fileId: "f1" },
      { id: "frame", type: "frame", index: "a3", groupIds: [] },
      { id: "framed", type: "rectangle", index: "a4", groupIds: [], frameId: "frame" },
      { id: "text", type: "text", index: "a5", groupIds: [], containerId: "box" },
    ], { f1: { id: "f1", dataURL: "data:image/png;base64,AA==", mimeType: "image/png", created: 1 } });
    const rel = module.createSceneHistoryController!(relationScene);
    const rv = rel.saveVersion({ name: "Relations", parentVersionId: null, scene: relationScene });
    const leftScene = scene(relationScene.elements.map((element: any) => element.id === "box" ? { ...element, x: 10 } : element), relationScene.files);
    const rightScene = scene(relationScene.elements.map((element: any) => element.id === "arrow" ? { ...element, y: 20 } : element), relationScene.files);
    const left = rel.saveVersion({ name: "Relation left", parentVersionId: rv.id, scene: leftScene });
    const right = rel.saveVersion({ name: "Relation right", parentVersionId: rv.id, scene: rightScene });
    rel.mergeVersions({ name: "Relation merge", baseVersionId: rv.id, versionIds: [left.id, right.id] });
    const checked = rel.getCurrentScene();
    let danglingRejected = false;
    try { rel.saveVersion({ name: "Dangling", parentVersionId: rv.id, scene: scene([{ id: "bad", index: "a0", groupIds: [], startBinding: { elementId: "missing" } }]) }); } catch { danglingRejected = true; }
    return kind === "relationship"
      ? checked.elements.find((item: any) => item.id === "arrow")?.startBinding?.elementId === "box"
        && checked.elements.find((item: any) => item.id === "box")?.boundElements?.[0]?.id === "arrow"
        && checked.elements.find((item: any) => item.id === "framed")?.frameId === "frame"
        && checked.elements.find((item: any) => item.id === "text")?.containerId === "box" && danglingRejected
      : checked.elements.filter((item: any) => item.groupIds?.includes("g")).length === 2 && checked.files.f1?.dataURL.includes("AA==");
  };
  test("relationship-integrity", () => relationCheck("relationship"));
  test("groups-and-assets", () => relationCheck("assets"));
  test("undo-boundary", () => {
    const relationScene = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [] }]);
    const rel = module.createSceneHistoryController!(relationScene);
    const rv = rel.saveVersion({ name: "Relations", parentVersionId: null, scene: relationScene });
    const movedRelationScene = scene(relationScene.elements.map((element: any) => ({ ...element, x: (element.x ?? 0) + 100 })), relationScene.files);
    const moved = rel.saveVersion({ name: "Moved relations", parentVersionId: rv.id, scene: movedRelationScene });
    const graphBeforeCheckout = stableScene(rel.listVersions());
    rel.checkout(rv.id);
    const afterCheckout = stableScene(rel.getCurrentScene());
    rel.undo();
    const afterUndo = stableScene(rel.getCurrentScene());
    rel.redo();
    const afterRedo = stableScene(rel.getCurrentScene());
    const mergeController = module.createSceneHistoryController!(relationScene);
    const mergeRoot = mergeController.saveVersion({ name: "Merge base", parentVersionId: null, scene: relationScene });
    const mergeLeftScene = scene([{ ...relationScene.elements[0], x: 10 }]);
    const mergeRightScene = scene([{ ...relationScene.elements[0], y: 20 }]);
    const mergeLeft = mergeController.saveVersion({ name: "Merge left", parentVersionId: mergeRoot.id, scene: mergeLeftScene });
    const mergeRight = mergeController.saveVersion({ name: "Merge right", parentVersionId: mergeRoot.id, scene: mergeRightScene });
    const mergeResult = mergeController.mergeVersions({ name: "Merge result", baseVersionId: mergeRoot.id, versionIds: [mergeLeft.id, mergeRight.id] });
    const mergeGraph = stableScene(mergeController.listVersions());
    const afterMerge = stableScene(mergeController.getCurrentScene());
    mergeController.undo();
    const afterMergeUndo = stableScene(mergeController.getCurrentScene());
    mergeController.redo();
    const afterMergeRedo = stableScene(mergeController.getCurrentScene());
    return afterCheckout === stableScene(relationScene)
      && afterUndo === stableScene(movedRelationScene)
      && afterRedo === stableScene(relationScene)
      && rel.listVersions().some((version: any) => version.id === moved.id)
      && stableScene(rel.listVersions()) === graphBeforeCheckout
      && afterMerge === stableScene(mergeResult.scene)
      && afterMergeUndo === stableScene(mergeRightScene)
      && afterMergeRedo === afterMerge
      && stableScene(mergeController.listVersions()) === mergeGraph;
  });
  test("export-boundary", () => {
    const base = scene([{ id: "img", type: "image", fileId: "f1", index: "a0", groupIds: [] }], { f1: { id: "f1", dataURL: "data:image/png;base64,AA==" } }, { viewBackgroundColor: "#ffffff", selectedElementIds: { img: true }, activeTool: { type: "rectangle" } });
    const rel = module.createSceneHistoryController!(base);
    rel.saveVersion({ name: "Base", parentVersionId: null, scene: base });
    const ordinary = JSON.parse(rel.exportCurrentScene());
    const history = JSON.parse(rel.exportHistory());
    return ordinary.type === "excalidraw" && ordinary.history === undefined
      && ordinary.appState.viewBackgroundColor === "#ffffff" && ordinary.appState.selectedElementIds === undefined && ordinary.appState.activeTool === undefined
      && history.type === "excalidraw-scene-history" && history.schemaVersion === 1 && Array.isArray(history.versions) && history.versions.length === 1
      && Object.values(history.snapshots ?? {}).some((snapshot: any) => snapshot.files?.f1?.dataURL?.includes("AA=="));
  });
  test("historical-compatibility", () => {
    const restored = typeof module.importSceneHistory === "function" ? module.importSceneHistory(JSON.stringify({ type: "excalidraw", version: 1, elements: [{ id: "legacy", type: "rectangle", customFutureField: "keep" }], appState: {}, files: {} })) : null;
    const legacy = restored?.getCurrentScene?.();
    const restoredV2 = typeof module.importSceneHistory === "function" ? module.importSceneHistory(JSON.stringify({ type: "excalidraw", version: 2, elements: [{ id: "legacy-v2", type: "rectangle", anotherFutureField: 42 }], appState: {}, files: {} })) : null;
    const historySource = module.createSceneHistoryController!(scene([{ id: "history", index: "a0", groupIds: [] }], { asset: { id: "asset", dataURL: "data:image/png;base64,AA==" } }));
    const historyRoot = historySource.saveVersion({ name: "History base", parentVersionId: null, scene: historySource.getCurrentScene() });
    historySource.saveVersion({ name: "History child", parentVersionId: historyRoot.id, scene: scene([{ id: "history", x: 1, index: "a0", groupIds: [] }], { asset: { id: "asset", dataURL: "data:image/png;base64,AA==" } }) });
    const importedHistory = module.importSceneHistory!(historySource.exportHistory());
    let rejectsFuture = false;
    try { module.importSceneHistory?.(JSON.stringify({ type: "excalidraw-scene-history", schemaVersion: 2, versions: [] })); } catch { rejectsFuture = true; }
    return legacy?.elements?.[0]?.customFutureField === "keep"
      && restoredV2?.getCurrentScene?.().elements?.[0]?.anotherFutureField === 42
      && importedHistory.listVersions().length === 2
      && JSON.parse(importedHistory.exportHistory()).snapshots
      && rejectsFuture;
  });
  return checks;
}

function scene(elements: any[], files: Record<string, any> = {}, appState: Record<string, any> = {}) { return { type: "excalidraw", version: 2, elements: structuredClone(elements), appState: structuredClone(appState), files: structuredClone(files) }; }
function stableScene(value: unknown) { return JSON.stringify(value, (_key, child) => child && typeof child === "object" && !Array.isArray(child) ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b))) : child); }

async function ensureCache(cacheDirectory: string, runCommand: CommandRunner) {
  try { await access(cacheDirectory); await verifyUpstream(cacheDirectory, runCommand); return; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await mkdir(dirname(cacheDirectory), { recursive: true, mode: 0o700 });
  const temporary = `${cacheDirectory}.tmp-${randomUUID()}`;
  await mkdir(temporary, { mode: 0o700 });
  try {
    await required(runCommand, "git", ["init", "--quiet"], temporary);
    await required(runCommand, "git", ["remote", "add", "origin", EXCALIDRAW_REPOSITORY_URL], temporary);
    await required(runCommand, "git", ["fetch", "--quiet", "--depth", "1", "origin", EXCALIDRAW_UPSTREAM_COMMIT], temporary);
    await required(runCommand, "git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"], temporary);
    await verifyUpstream(temporary, runCommand);
    try { await rename(temporary, cacheDirectory); } catch (error) {
      if (!(error instanceof Error) || !["EEXIST", "ENOTEMPTY"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
      await verifyUpstream(cacheDirectory, runCommand);
    }
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

async function verifyUpstream(directory: string, runCommand: CommandRunner) {
  const commit = (await required(runCommand, "git", ["rev-parse", "HEAD"], directory)).stdout.trim();
  const tree = (await required(runCommand, "git", ["rev-parse", "HEAD^{tree}"], directory)).stdout.trim();
  if (commit !== EXCALIDRAW_UPSTREAM_COMMIT || tree !== EXCALIDRAW_UPSTREAM_TREE) throw new Error(`Pinned Excalidraw source mismatch: ${commit}/${tree}.`);
  const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as { packageManager?: string; engines?: { node?: string } };
  const license = await readFile(join(directory, "LICENSE"), "utf8");
  if (manifest.packageManager !== EXCALIDRAW_PACKAGE_MANAGER || manifest.engines?.node !== EXCALIDRAW_NODE_RANGE || !license.startsWith("MIT License\n")) throw new Error("Pinned Excalidraw environment or license does not match the fixture contract.");
}

async function seedCompatibility(directory: string) {
  const manifestPath = join(directory, "package.json");
  const lockPath = join(directory, "yarn.lock");
  await writeFile(manifestPath, seedExcalidrawCompatibilityManifest(await readFile(manifestPath, "utf8")), "utf8");
  await writeFile(lockPath, seedExcalidrawCompatibilityLock(await readFile(lockPath, "utf8")), "utf8");
}

async function verifySeeded(directory: string, runCommand: CommandRunner) {
  const [commit, tree, parent] = await Promise.all([
    required(runCommand, "git", ["rev-parse", "HEAD"], directory),
    required(runCommand, "git", ["rev-parse", "HEAD^{tree}"], directory),
    required(runCommand, "git", ["rev-parse", "HEAD^"], directory),
  ]);
  if (commit.stdout.trim() !== EXCALIDRAW_SEEDED_COMMIT || tree.stdout.trim() !== EXCALIDRAW_SEEDED_TREE || parent.stdout.trim() !== EXCALIDRAW_UPSTREAM_COMMIT) throw new Error(`Seeded Excalidraw fixture identity mismatch: ${commit.stdout.trim()}/${tree.stdout.trim()}.`);
}

async function withPristineVerifierWorkspace<T>(candidateDirectory: string, runCommand: CommandRunner, verify: (directory: string) => Promise<T>): Promise<T> {
  const temporary = await mkdtemp(join(tmpdir(), "relayer-excalidraw-verifier-"));
  const verifierDirectory = join(temporary, "workspace");
  const patchPath = join(temporary, "candidate.patch");
  try {
    const patch = await required(runCommand, "git", ["diff", "--binary", `${EXCALIDRAW_SEEDED_COMMIT}..HEAD`, "--"], candidateDirectory);
    await writeFile(patchPath, patch.stdout, "utf8");
    await required(runCommand, "git", ["clone", "--local", "--no-hardlinks", "--no-checkout", candidateDirectory, verifierDirectory], temporary);
    await required(runCommand, "git", ["checkout", "--detach", EXCALIDRAW_SEEDED_COMMIT], verifierDirectory);
    if (patch.stdout) await required(runCommand, "git", ["apply", "--whitespace=nowarn", patchPath], verifierDirectory);
    await required(runCommand, "corepack", [EXCALIDRAW_PACKAGE_MANAGER, "install", "--frozen-lockfile", "--ignore-scripts", "--non-interactive"], verifierDirectory, { HUSKY: "0" });
    return await verify(verifierDirectory);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

function hiddenVerifierSource() {
  const portable = evaluatePortableContract.toString();
  const sceneSource = scene.toString();
  const stable = stableScene.toString();
  return `import React from "react";\nimport { render, screen } from "@testing-library/react";\nimport { describe, expect, it } from "vitest";\nimport * as subject from "../index";\nconst VERIFIER_CHECKS=${JSON.stringify(VERIFIER_CHECKS)};\nconst evaluate=${portable};\nconst scene=${sceneSource};\nconst stableScene=${stable};\nconst checks=evaluate(subject,false);\ndescribe("Relayer sealed scene-history contract",()=>{for(const check of checks.filter(({id})=>id!=="public-ui")){it(check.id,()=>expect(check.passed).toBe(true));}it("public-ui",()=>{const controller=subject.createSceneHistoryController(scene([]));render(React.createElement(subject.SceneHistoryPanel,{controller}));expect(screen.getByRole("region",{name:/scene history/i})).toBeTruthy();for(const name of ["Save version","Checkout version","Merge versions","Resolve conflicts","Export history"]){expect(screen.getByRole("button",{name})).toBeTruthy();}});});\n`;
}

function parseBehaviorChecks(result: CommandResult) {
  const checks = new Map<string, boolean>();
  try {
    const report = JSON.parse(result.stdout) as { testResults?: Array<{ assertionResults?: Array<{ title?: string; status?: string }> }> };
    for (const file of report.testResults ?? []) for (const assertion of file.assertionResults ?? []) {
      if (assertion.title && VERIFIER_CHECKS.includes(assertion.title)) checks.set(assertion.title, assertion.status === "passed");
    }
  } catch { /* non-JSON failures are represented by the command result */ }
  return checks;
}

function replaceOnce(source: string, search: string, replacement: string) {
  if (source.split(search).length !== 2) throw new Error("Pinned Excalidraw source no longer matches the compatibility seed contract.");
  return source.replace(search, replacement);
}

function assertSupportedNode(version: string) { const major = Number(version.split(".")[0]); if (major < 18 || major > 22) throw new Error(`The pinned Excalidraw fixture requires Node ${EXCALIDRAW_NODE_RANGE}; received ${version}.`); }
async function requireMissing(path: string, label: string) { try { await access(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; } throw new Error(`Refusing to overwrite existing ${label}: ${path}`); }
function lines(value: string) { return value.split("\n").map((line) => line.trim()).filter(Boolean); }
function commandDetail(label: string, result: CommandResult) { return `${label} exited ${result.exitCode}.${result.stderr.trim() ? ` stderr: ${result.stderr.trim().slice(0, 1000)}` : ""}${result.stdout.trim() ? ` stdout: ${result.stdout.trim().slice(0, 1000)}` : ""}`; }
function fixtureCommitEnvironment() { return { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)), GIT_AUTHOR_NAME: "Relayer Eval Fixture", GIT_AUTHOR_EMAIL: "eval-fixture@relayer.local", GIT_AUTHOR_DATE: "2026-08-28T12:00:00Z", GIT_COMMITTER_NAME: "Relayer Eval Fixture", GIT_COMMITTER_EMAIL: "eval-fixture@relayer.local", GIT_COMMITTER_DATE: "2026-08-28T12:00:00Z" }; }

async function required(runCommand: CommandRunner, command: string, args: readonly string[], cwd: string, env?: Readonly<Record<string, string>>) { const result = await runCommand(command, args, { cwd, ...(env ? { env: { ...process.env, ...env } as Record<string, string> } : {}) }); if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`); return result; }
const run: CommandRunner = (command, args, options) => new Promise((resolve, reject) => { const child = spawn(command, [...args], { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; child.stdout.on("data", (chunk) => { stdout += String(chunk); }); child.stderr.on("data", (chunk) => { stderr += String(chunk); }); child.once("error", reject); child.once("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr })); });
