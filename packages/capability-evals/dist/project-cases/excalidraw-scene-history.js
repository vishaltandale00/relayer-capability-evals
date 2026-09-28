import { createHash, randomUUID } from "node:crypto";
import { access, lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { bindAutonomousCaseSnapshot } from "@relayer/eval-runner";
import { createAutonomousCaseSnapshot } from "@relayer/eval-runner";
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
export const EXCALIDRAW_VERIFIER_SOURCE_SHA256 = "3b511717909c24f044513c39b722e25a90472a8254a2e4ef38da931bc33ea8ea";
const VERIFIER_CHECKS = Object.freeze([
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
]);
export const EXCALIDRAW_QUALIFICATION_AUTHORITY_V1 = Object.freeze({
    id: "excalidraw-scene-history-qualification-authority-v1",
    seededCommit: EXCALIDRAW_SEEDED_COMMIT,
    files: Object.freeze([
        Object.freeze({ path: "package.json", digest: "sha256:af667c09b686361d0016b68ae7052a89ac56f0716735c0ec902fa56aca8735ab" }),
        Object.freeze({ path: "yarn.lock", digest: "sha256:ce8b2dd86356140d4d12700f75d0de9fcf91b9ed8d70547834c805b3b113bec2" }),
        Object.freeze({ path: "vitest.config.mts", digest: "sha256:36af77c8c95f53a5946289a1ceac2c9b3c96c25a23639b7a8f79526b129bb002" }),
        Object.freeze({ path: "setupTests.ts", digest: "sha256:edf1c801973fa6fa27dc4f383491a4a3ce64042d2389aa6afa8258d443d62ffb" }),
        Object.freeze({ path: "packages/excalidraw/package.json", digest: "sha256:402f54fc7de128b25d22bd4d905fb46dbcdbe2ce6efee567d4da0fc79a29aab1" }),
        Object.freeze({ path: "packages/excalidraw/tsconfig.json", digest: "sha256:2ca485bc01425b542b3eef10d615c269f6b6448d12bc4523e430a705e037b968" }),
        Object.freeze({ path: "scripts/buildPackage.js", digest: "sha256:bbacb59e932431ec3dcf1b99b3d41253dbed2fc30391a07793d21f2d819834bd" }),
        Object.freeze({ path: ".npmrc", digest: "sha256:5435eb27737e90ee4adccbe4626aeb2bb6152f76872d9dbabb3e5483aa6da44f" }),
        Object.freeze({ path: "tsconfig.json", digest: "sha256:1cc235e789b858eb3fd133a1bb3e98ff20c22d3c0eb8eacb873454435bb25138" }),
        Object.freeze({ path: ".yarnrc", digest: null }),
        Object.freeze({ path: ".yarnrc.yml", digest: null }),
    ]),
    paths: Object.freeze(["package.json", "yarn.lock", "vitest.config.mts", "setupTests.ts", "packages/excalidraw/package.json", "packages/excalidraw/tsconfig.json", "scripts/buildPackage.js", ".npmrc", "tsconfig.json", ".yarnrc", ".yarnrc.yml"]),
});
const ADMISSION_CHECK_NAMES = Object.freeze([
    ...VERIFIER_CHECKS.map((id) => `workspace:scene-history-${id}`),
    "workspace:scene-history-qualification-authority",
    "workspace:scene-history-build",
    "workspace:scene-history-upstream-tests",
    "workspace:scene-history-commit",
    "workspace:scene-history-clean",
]);
const TASK = `Add branching scene history to Excalidraw as a substantial user-visible feature. Export a public opaque controller through @excalidraw/excalidraw, plus an accessible SceneHistoryPanel({ controller }) with a labelled Scene history region and working controls named Save version, Checkout version, Merge versions, Resolve conflicts, and Export history. The controls may use inline fields or dialogs and any layout. Their accessible names identify the semantic value they collect: version name, checkout version, merge name, merge base, first merge version, second merge version, and resolution for the displayed conflict. createSceneHistoryController(initialScene, editor?) accepts an optional public Excalidraw imperative API. With an editor, Save captures its live elements, files, and app state at activation time; checkout and a completed merge apply to it with CaptureUpdateAction.IMMEDIATELY as exactly one native undo entry. The controller must expose importSceneHistory(serialized), listVersions(), saveVersion({ name, parentVersionId?, scene? }), checkout(versionId), mergeVersions({ name, baseVersionId, versionIds, resolutions? }), resolveMerge(mergeId, resolutions), getCurrentScene(), exportHistory(), exportCurrentScene(), undo(), and redo(). listVersions() and saveVersion() return versions shaped { id, name, parentIds }; checkout() and getCurrentScene() return scene snapshots. A successful merge returns { status: "merged", version, scene }; an unresolved merge returns { status: "conflicts", mergeId, conflicts }, where each stable conflict is { id, kind, path, base, left, right }. resolutions is an object keyed by every conflict ID with "left", "right", or an explicit replacement value. exportHistory() and exportCurrentScene() return serialized JSON.

Version names are non-empty after NFC normalization, case-sensitive, and unique. Versions are immutable, have stable IDs, and store explicit parent IDs. Saving from history creates a branch without rewriting descendants or siblings. Merge takes an explicit common-ancestor base and two unordered parents. It performs deterministic three-way merge by element ID and JSON field path, treating arrays atomically; one-sided and identical edits merge automatically. Same-field divergence, modify/delete, divergent same-ID additions, and byte-different same-ID assets surface stable conflicts, and no merge version may exist until all conflicts are resolved. Element order is Excalidraw fractional index then ID; version, versionNonce, and updated are revision metadata rather than semantic conflicts. Bindings, groups, frames, containers, and assets are integrity-coupled and may not be silently dropped or repaired.

Versions contain elements, files, and export-safe document app state, excluding transient selection/tool state. Checkout and completed merge each apply as one ordinary undo step; undo changes the displayed scene, never the immutable version graph. Ordinary .excalidraw export remains current-scene-only. A separate schema-v1 history export contains the complete graph, snapshots, and assets. Import ordinary Excalidraw v1/v2 documents through upstream restoration while preserving unknown element fields; reject unsupported future history schemas. Qualification executes the seeded root package scripts and test environment. The following authority files must remain byte-identical to the seeded commit: package.json, yarn.lock, vitest.config.mts, setupTests.ts, packages/excalidraw/package.json, packages/excalidraw/tsconfig.json, scripts/buildPackage.js, .npmrc, and tsconfig.json. The seeded-absent .yarnrc and .yarnrc.yml must remain absent. Feature source, exports, and tests remain editable. Add focused tests, run the bounded package build and relevant history/restore/export tests, and create at least one meaningful local commit. Do not push or publish.`;
const fixture = Object.freeze({
    repositoryUrl: EXCALIDRAW_REPOSITORY_URL,
    upstreamCommit: EXCALIDRAW_UPSTREAM_COMMIT,
    upstreamTree: EXCALIDRAW_UPSTREAM_TREE,
    seededCommit: EXCALIDRAW_SEEDED_COMMIT,
    seededTree: EXCALIDRAW_SEEDED_TREE,
    packageManager: EXCALIDRAW_PACKAGE_MANAGER,
    node: EXCALIDRAW_NODE_RANGE,
    license: "MIT",
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
});
const digest = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
export function excalidrawVerifierDigest() {
    return digest([
        EXCALIDRAW_VERIFIER_SOURCE_SHA256,
        JSON.stringify(VERIFIER_CHECKS),
        JSON.stringify(fixture),
    ].join("\n"));
}
const criteria = Object.freeze([
    { id: "history-correctness", label: "History correctness", description: "Named versions, branching, merge, conflicts, integrity, undo, and export follow the v1 contract.", weight: 4 },
    { id: "user-experience", label: "Usable scene history", description: "The feature is accessible and integrated into Excalidraw without regressing ordinary editing and export.", weight: 1 },
]);
export const excalidrawSceneHistoryCase = bindAutonomousCaseSnapshot(definition, createAutonomousCaseSnapshot({
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
            contentDigest: "sha256:61b53d69ef57055aa27c1e78003341f3f1b36fb1e7f69cdfbddd09877655ed93",
            sealedPath: "eval-cases/excalidraw-scene-history/solution/reference-manifest.json",
        },
        verifier: {
            kind: "sealed-verifier",
            artifactId: "excalidraw-scene-history-verifier-v1",
            verifierId: "excalidraw-scene-history-v1",
            contentDigest: excalidrawVerifierDigest(),
            sealedPath: "packages/capability-evals/src/project-cases/excalidraw-scene-history.ts",
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
}));
export function seedExcalidrawCompatibilityManifest(source) {
    if (source.includes('"@types/mime-types"') || source.includes('"@types/retry"')) {
        throw new Error("Pinned Excalidraw manifest already contains the compatibility dependencies.");
    }
    const withMime = replaceOnce(source, '    "@types/lodash.throttle": "4.1.7",\n', '    "@types/lodash.throttle": "4.1.7",\n    "@types/mime-types": "2.1.4",\n');
    return replaceOnce(withMime, '    "@types/react-dom": "19.0.4",\n', '    "@types/react-dom": "19.0.4",\n    "@types/retry": "0.12.5",\n');
}
export function seedExcalidrawCompatibilityLock(source) {
    if (source.includes('"@types/mime-types@2.1.4"') || source.includes('"@types/retry@0.12.5"')) {
        throw new Error("Pinned Excalidraw lockfile already contains the compatibility dependencies.");
    }
    const mime = `"@types/mime-types@2.1.4":\n  version "2.1.4"\n  resolved "https://registry.yarnpkg.com/@types/mime-types/-/mime-types-2.1.4.tgz#93a1933e24fed4fb9e4adc5963a63efcbb3317a2"\n  integrity sha512-lfU4b34HOri+kAY5UheuFMWPDOI+OPceBSHZKp69gEyTL/mmJ4cnU6Y/rlme3UL3GyOn6Y42hyIEw0/q8sWx5w==\n\n`;
    const retry = `"@types/retry@0.12.5":\n  version "0.12.5"\n  resolved "https://registry.yarnpkg.com/@types/retry/-/retry-0.12.5.tgz#f090ff4bd8d2e5b940ff270ab39fd5ca1834a07e"\n  integrity sha512-3xSjTp3v03X/lSQLkczaN9UIEwJMoMCA1+Nb5HfbJEQWogdeQIyVtTvxPXDQjZ5zws8rFQfVfRdz03ARihPJgw==\n\n`;
    const withMime = replaceOnce(source, '"@types/node@*":\n', `${mime}"@types/node@*":\n`);
    return replaceOnce(withMime, '"@types/semver@^7.3.12":\n', `${retry}"@types/semver@^7.3.12":\n`);
}
export async function materializeExcalidrawSceneHistoryFixture(options) {
    if ((options.platform ?? process.platform) !== "darwin")
        throw new Error("The Excalidraw scene-history case is local Mac only.");
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
    if (status.stdout.trim())
        throw new Error(`Frozen Excalidraw install changed the workspace: ${status.stdout.trim()}`);
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
export async function gradeExcalidrawSceneHistoryWorkspace(options) {
    const runCommand = options.runCommand ?? run;
    const qualificationAuthorityVerifier = options.qualificationAuthorityVerifier ?? verifyQualificationAuthority;
    let verified = null;
    let qualificationAuthorityPassed = true;
    let qualificationAuthorityDetail = "Seeded qualification authority files are unchanged.";
    try {
        verified = await withPristineVerifierWorkspace(options.workspaceDirectory, runCommand, qualificationAuthorityVerifier, async (directory) => {
            const hiddenPath = join(directory, "packages", "excalidraw", "tests", ".relayer-scene-history.test.tsx");
            await writeFile(hiddenPath, hiddenVerifierSource(), "utf8");
            try {
                const behavior = await runCommand("corepack", [EXCALIDRAW_PACKAGE_MANAGER, "test:app", "--watch=false", "packages/excalidraw/tests/.relayer-scene-history.test.tsx", "--reporter=json"], { cwd: directory });
                const build = await runCommand("corepack", [EXCALIDRAW_PACKAGE_MANAGER, "build:package"], { cwd: directory });
                const regression = await runCommand("corepack", [EXCALIDRAW_PACKAGE_MANAGER, "test:app", "--watch=false", "packages/excalidraw/tests/history.test.tsx", "packages/excalidraw/tests/data/restore.test.ts", "packages/excalidraw/tests/export.test.tsx", "packages/excalidraw/tests/scene/export.test.ts", "--reporter=dot"], { cwd: directory });
                return { behavior, build, regression };
            }
            finally {
                await rm(hiddenPath, { force: true });
            }
        });
    }
    catch (error) {
        if (!(error instanceof QualificationAuthorityError))
            throw error;
        qualificationAuthorityPassed = false;
        qualificationAuthorityDetail = error.message;
    }
    const behaviorChecks = verified ? parseBehaviorChecks(verified.behavior) : new Map();
    const status = (await required(runCommand, "git", ["status", "--porcelain=v1", "--untracked-files=all"], options.workspaceDirectory)).stdout.trim();
    const commits = lines((await required(runCommand, "git", ["rev-list", `${EXCALIDRAW_SEEDED_COMMIT}..HEAD`], options.workspaceDirectory)).stdout);
    return [
        ...VERIFIER_CHECKS.map((id) => ({
            name: `workspace:scene-history-${id}`,
            passed: qualificationAuthorityPassed ? behaviorChecks.get(id) === true : false,
            detail: qualificationAuthorityPassed
                ? (behaviorChecks.has(id) ? `Sealed public-seam predicate ${id}: ${behaviorChecks.get(id) ? "passed" : "failed"}.` : commandDetail(`sealed predicate ${id}`, verified.behavior))
                : `Not executed because qualification authority rejected the candidate before commands ran; this predicate is not the rejection reason.`,
        })),
        { name: "workspace:scene-history-qualification-authority", passed: qualificationAuthorityPassed, detail: qualificationAuthorityPassed ? qualificationAuthorityDetail : `${qualificationAuthorityDetail} No install, build, or test command ran.` },
        { name: "workspace:scene-history-build", passed: qualificationAuthorityPassed ? verified.build.exitCode === 0 : false, detail: qualificationAuthorityPassed ? commandDetail("Excalidraw package build", verified.build) : "Not executed after qualification authority rejection." },
        { name: "workspace:scene-history-upstream-tests", passed: qualificationAuthorityPassed ? verified.regression.exitCode === 0 : false, detail: qualificationAuthorityPassed ? commandDetail("focused upstream history/restore/export tests", verified.regression) : "Not executed after qualification authority rejection." },
        { name: "workspace:scene-history-commit", passed: commits.length >= 1, detail: `${commits.length} post-fixture commit(s).` },
        { name: "workspace:scene-history-clean", passed: status === "", detail: status === "" ? "The candidate workspace is clean." : `Uncommitted changes remain: ${status}` },
    ];
}
export async function runExcalidrawPortablePortfolio(options) {
    const results = [];
    for (const entry of options.entries) {
        const modulePath = entry.modulePath;
        if (!modulePath) {
            results.push({ id: entry.id, expectation: entry.expectation, passed: false, checks: VERIFIER_CHECKS.map((id) => ({ id, passed: false })) });
            continue;
        }
        const imported = await import(`${pathToFileURL(modulePath).href}?portfolio=${randomUUID()}`);
        const checks = evaluatePortableContract(imported, false).map((check) => check.id === "public-ui" || check.id === "native-assets-appstate" ? { ...check, passed: false } : check);
        const green = checks.filter(({ id }) => id !== "public-ui" && id !== "native-assets-appstate").every((check) => check.passed);
        const expected = entry.expectation === "green" ? green : !green;
        results.push({ id: entry.id, expectation: entry.expectation, passed: expected, checks });
    }
    return { admitted: results.length >= 3 && results.every((entry) => entry.passed) && results.filter((entry) => entry.expectation === "green").length >= 2, entries: results };
}
export const EXCALIDRAW_ADMISSION_PORTFOLIO_V1 = Object.freeze({
    id: "excalidraw-scene-history-admission-v1",
    baselineId: "untouched",
    greenIds: Object.freeze(["green-functional", "green-command-log"]),
    mutantIds: Object.freeze(["mutant-forged-verdict", "mutant-forged-runner", "mutant-forged-yarnrc", "mutant-ui-inert", "mutant-ui-miswired", "mutant-branch-overwrite", "mutant-silent-lww", "mutant-relationships", "mutant-undo", "mutant-history-loss"]),
    expectedFailures: Object.freeze({
        untouched: Object.freeze([...ADMISSION_CHECK_NAMES.filter((name) => VERIFIER_CHECKS.some((id) => name === `workspace:scene-history-${id}`)), "workspace:scene-history-commit"]),
        "mutant-forged-verdict": Object.freeze(ADMISSION_CHECK_NAMES.filter((name) => VERIFIER_CHECKS.some((id) => name === `workspace:scene-history-${id}`))),
        "mutant-forged-runner": Object.freeze([
            ...VERIFIER_CHECKS.map((id) => `workspace:scene-history-${id}`),
            "workspace:scene-history-qualification-authority",
            "workspace:scene-history-build",
            "workspace:scene-history-upstream-tests",
        ]),
        "mutant-forged-yarnrc": Object.freeze([
            ...VERIFIER_CHECKS.map((id) => `workspace:scene-history-${id}`),
            "workspace:scene-history-qualification-authority",
            "workspace:scene-history-build",
            "workspace:scene-history-upstream-tests",
        ]),
        "mutant-ui-inert": Object.freeze(["workspace:scene-history-public-ui"]),
        "mutant-ui-miswired": Object.freeze(["workspace:scene-history-public-ui"]),
        "mutant-branch-overwrite": Object.freeze(["workspace:scene-history-historical-branching", "workspace:scene-history-deterministic-merge"]),
        "mutant-silent-lww": Object.freeze(["workspace:scene-history-public-ui", "workspace:scene-history-conflict-taxonomy", "workspace:scene-history-undo-boundary"]),
        "mutant-relationships": Object.freeze(["workspace:scene-history-relationship-integrity"]),
        "mutant-undo": Object.freeze(["workspace:scene-history-undo-boundary"]),
        "mutant-history-loss": Object.freeze(["workspace:scene-history-public-ui", "workspace:scene-history-historical-compatibility"]),
    }),
});
export async function runExcalidrawAdmissionPortfolio(options) {
    const runCommand = options.runCommand ?? run;
    const gradeWorkspace = options.gradeWorkspace ?? gradeExcalidrawSceneHistoryWorkspace;
    const requiredIds = [EXCALIDRAW_ADMISSION_PORTFOLIO_V1.baselineId, ...EXCALIDRAW_ADMISSION_PORTFOLIO_V1.greenIds, ...EXCALIDRAW_ADMISSION_PORTFOLIO_V1.mutantIds];
    const requestedIds = options.entries.map(({ id }) => id);
    const entryById = new Map(options.entries.map((entry) => [entry.id, entry]));
    const typedRoster = entryById.get(EXCALIDRAW_ADMISSION_PORTFOLIO_V1.baselineId)?.expectation === "red"
        && EXCALIDRAW_ADMISSION_PORTFOLIO_V1.greenIds.every((id) => entryById.get(id)?.expectation === "green")
        && EXCALIDRAW_ADMISSION_PORTFOLIO_V1.mutantIds.every((id) => entryById.get(id)?.expectation === "mutant");
    const intendedReasons = Object.entries(EXCALIDRAW_ADMISSION_PORTFOLIO_V1.expectedFailures).every(([id, expected]) => {
        const declared = entryById.get(id)?.expectedFailedChecks ?? [];
        return declared.length === expected.length && expected.every((name) => declared.includes(name));
    });
    if (options.portfolioId && (requestedIds.length !== requiredIds.length || new Set(requestedIds).size !== requestedIds.length || !requiredIds.every((id) => requestedIds.includes(id)) || !typedRoster || !intendedReasons)) {
        throw new Error(`Portfolio ${options.portfolioId} requires the exact versioned entry roster.`);
    }
    await verifySeeded(options.fixtureDirectory, runCommand);
    const workspaceRoot = options.artifactsDirectory ? join(options.artifactsDirectory, "workspaces") : tmpdir();
    if (options.artifactsDirectory) {
        await mkdir(workspaceRoot, { recursive: true });
        await mkdir(join(options.artifactsDirectory, "receipts"), { recursive: true });
    }
    const results = [];
    for (const [index, entry] of options.entries.entries()) {
        const safeId = entry.id.replace(/[^a-zA-Z0-9._-]/g, "_");
        const temporary = await mkdtemp(join(workspaceRoot, `${String(index + 1).padStart(2, "0")}-${safeId}-`));
        const workspaceDirectory = join(temporary, "workspace");
        let inputs = [];
        let retainWorkspace = false;
        try {
            inputs = await Promise.all(entry.patchPaths.map(async (path) => ({
                path,
                digest: `sha256:${createHash("sha256").update(await readFile(path)).digest("hex")}`,
            })));
            await required(runCommand, "git", ["clone", "--local", "--no-hardlinks", "--no-checkout", options.fixtureDirectory, workspaceDirectory], temporary);
            await required(runCommand, "git", ["checkout", "--detach", EXCALIDRAW_SEEDED_COMMIT], workspaceDirectory);
            for (const patchPath of entry.patchPaths)
                await required(runCommand, "git", ["apply", "--whitespace=nowarn", patchPath], workspaceDirectory);
            if (entry.patchPaths.length > 0) {
                await required(runCommand, "git", ["add", "--all"], workspaceDirectory);
                await required(runCommand, "git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", "commit", "-m", `Admission fixture: ${entry.id}`], workspaceDirectory, fixtureCommitEnvironment());
            }
            const checks = await gradeWorkspace({ workspaceDirectory, runCommand });
            const verdict = evaluateAdmissionEntry(entry, checks);
            const result = { id: entry.id, expectation: entry.expectation, passed: verdict.passed, checks, verdictDetail: verdict.detail, inputDigests: inputs.map(({ digest }) => digest) };
            results.push(result);
            retainWorkspace = !result.passed;
            if (options.artifactsDirectory)
                await writeFile(join(options.artifactsDirectory, "receipts", `${String(index + 1).padStart(2, "0")}-${safeId}.json`), `${JSON.stringify({ ...result, inputs, workspaceDirectory: retainWorkspace ? workspaceDirectory : null }, null, 2)}\n`, "utf8");
        }
        catch (error) {
            retainWorkspace = true;
            if (options.artifactsDirectory)
                await writeFile(join(options.artifactsDirectory, "receipts", `${String(index + 1).padStart(2, "0")}-${safeId}.json`), `${JSON.stringify({ id: entry.id, expectation: entry.expectation, passed: false, inputs, workspaceDirectory, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`, "utf8");
            throw error;
        }
        finally {
            if (!retainWorkspace)
                await rm(temporary, { recursive: true, force: true });
        }
    }
    const actualIds = results.map(({ id }) => id);
    const exactVersionedRoster = options.portfolioId === EXCALIDRAW_ADMISSION_PORTFOLIO_V1.id
        && actualIds.length === requiredIds.length
        && new Set(actualIds).size === actualIds.length
        && requiredIds.every((id) => actualIds.includes(id));
    const greenInputSignatures = EXCALIDRAW_ADMISSION_PORTFOLIO_V1.greenIds.map((id) => results.find((entry) => entry.id === id)?.inputDigests.join("\n"));
    const distinctGreens = greenInputSignatures.every(Boolean) && new Set(greenInputSignatures).size === greenInputSignatures.length;
    return {
        portfolioId: options.portfolioId ?? null,
        admitted: exactVersionedRoster && distinctGreens && results.every((entry) => entry.passed),
        entries: results,
    };
}
function evaluateAdmissionEntry(entry, checks) {
    const names = checks.map(({ name }) => name);
    if (new Set(names).size !== names.length)
        return { passed: false, detail: "Duplicate grader check names invalidate admission." };
    const unknownChecks = names.filter((name) => !ADMISSION_CHECK_NAMES.includes(name));
    const missingChecks = ADMISSION_CHECK_NAMES.filter((name) => !names.includes(name));
    if (unknownChecks.length > 0 || missingChecks.length > 0)
        return { passed: false, detail: `The grader check set drifted (unknown: ${unknownChecks.join(", ") || "none"}; missing: ${missingChecks.join(", ") || "none"}).` };
    const expected = entry.expectedFailedChecks ?? [];
    if (new Set(expected).size !== expected.length)
        return { passed: false, detail: "Duplicate expected-failure names invalidate admission." };
    if (entry.expectation === "green" && expected.length > 0)
        return { passed: false, detail: "Green entries cannot declare expected failures." };
    if (entry.expectation !== "green" && expected.length === 0)
        return { passed: false, detail: "Red and mutant entries must declare their intended failed checks." };
    const missing = expected.filter((name) => !names.includes(name));
    if (missing.length > 0)
        return { passed: false, detail: `Expected grader checks are missing: ${missing.join(", ")}.` };
    const actualFailures = checks.filter(({ passed }) => !passed).map(({ name }) => name);
    const unexpected = actualFailures.filter((name) => !expected.includes(name));
    const absent = expected.filter((name) => !actualFailures.includes(name));
    if (unexpected.length > 0 || absent.length > 0)
        return { passed: false, detail: `Admission failed for unintended reasons (unexpected: ${unexpected.join(", ") || "none"}; absent: ${absent.join(", ") || "none"}).` };
    return { passed: true, detail: entry.expectation === "green" ? "All declared checks passed." : `Rejected for intended checks: ${expected.join(", ")}.` };
}
function evaluatePortableContract(module, inspectPortableUi = true) {
    const checks = VERIFIER_CHECKS.map((id) => ({ id, passed: false }));
    const set = (id, passed) => { const found = checks.find((check) => check.id === id); if (found)
        found.passed = passed; };
    const test = (id, predicate) => { try {
        set(id, predicate() === true);
    }
    catch {
        set(id, false);
    } };
    test("public-ui", () => {
        if (typeof module.createSceneHistoryController !== "function" || typeof module.SceneHistoryPanel !== "function" || typeof module.importSceneHistory !== "function")
            return false;
        if (!inspectPortableUi)
            return true;
        const calls = [];
        const controller = {
            getCurrentScene: () => scene([]),
            saveVersion: () => calls.push("Save version"),
            checkout: () => calls.push("Checkout version"),
            mergeVersions: () => { calls.push("Merge versions"); return { status: "conflicts", mergeId: "pending", conflicts: [] }; },
            resolveMerge: () => calls.push("Resolve conflicts"),
            exportHistory: () => { calls.push("Export history"); return "{}"; },
        };
        const root = module.SceneHistoryPanel({ controller });
        const nodes = [root];
        let region = false;
        const buttons = new Map();
        while (nodes.length) {
            const node = nodes.shift();
            if (node === null || node === undefined || typeof node === "boolean")
                continue;
            if (Array.isArray(node)) {
                nodes.push(...node);
                continue;
            }
            if (typeof node !== "object")
                continue;
            const props = node.props ?? node;
            const label = String(props["aria-label"] ?? props.ariaLabel ?? "");
            if (props.role === "region" && /scene history/i.test(label))
                region = true;
            if ((node.type === "button" || props.role === "button") && typeof props.children === "string" && typeof props.onClick === "function")
                buttons.set(props.children, props.onClick);
            if (props.children !== undefined)
                nodes.push(props.children);
        }
        const names = ["Save version", "Checkout version", "Merge versions", "Resolve conflicts", "Export history"];
        if (!region || !names.every((name) => buttons.has(name)))
            return false;
        for (const name of names)
            buttons.get(name)();
        return calls.join("|") === names.join("|");
    });
    test("named-immutable-versions", () => {
        const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [], version: 1 }]);
        const controller = module.createSceneHistoryController(base);
        const root = controller.saveVersion({ name: "Base", parentVersionId: null, scene: base });
        const leftScene = scene([{ id: "a", x: 10, y: 0, index: "a0", groupIds: [], version: 2 }]);
        controller.saveVersion({ name: "Left", parentVersionId: root.id, scene: leftScene });
        const before = stableScene(controller.listVersions());
        const mutableCheckout = controller.checkout(root.id);
        mutableCheckout.elements[0].x = 999;
        controller.checkout(root.id);
        let emptyRejected = false;
        let equivalentRejected = false;
        try {
            controller.saveVersion({ name: "   ", parentVersionId: root.id, scene: base });
        }
        catch {
            emptyRejected = true;
        }
        const accented = controller.saveVersion({ name: "\u00e9", parentVersionId: root.id, scene: base });
        try {
            controller.saveVersion({ name: "e\u0301", parentVersionId: root.id, scene: base });
        }
        catch {
            equivalentRejected = true;
        }
        const caseDistinct = controller.saveVersion({ name: "\u00c9", parentVersionId: root.id, scene: base });
        return controller.getCurrentScene().elements[0].x === 0
            && stableScene(controller.listVersions().slice(0, 2)) === before
            && emptyRejected && equivalentRejected
            && accented.name === "\u00e9" && caseDistinct.name === "\u00c9";
    });
    test("historical-branching", () => {
        const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [] }]);
        const controller = module.createSceneHistoryController(base);
        const root = controller.saveVersion({ name: "Base", parentVersionId: null, scene: base });
        const left = controller.saveVersion({ name: "Left", parentVersionId: root.id, scene: scene([{ ...base.elements[0], x: 10 }]) });
        const right = controller.saveVersion({ name: "Right", parentVersionId: root.id, scene: scene([{ ...base.elements[0], y: 20 }]) });
        const versions = controller.listVersions();
        return left.parentIds?.[0] === root.id && right.parentIds?.[0] === root.id && versions.length === 3
            && versions.some((version) => version.id === left.id) && versions.some((version) => version.id === right.id);
    });
    test("deterministic-merge", () => {
        const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [], version: 1 }]);
        const controller = module.createSceneHistoryController(base);
        const root = controller.saveVersion({ name: "Base", parentVersionId: null, scene: base });
        const leftScene = scene([{ id: "a", x: 10, y: 0, index: "a0", groupIds: [], fillColor: "red", version: 2 }, { id: "z", x: 0, index: "a1", groupIds: [] }]);
        const rightScene = scene([{ id: "a", x: 0, y: 20, index: "a0", groupIds: [], fillColor: "red", version: 3 }, { id: "b", x: 0, index: "a1", groupIds: [] }]);
        const left = controller.saveVersion({ name: "Left", parentVersionId: root.id, scene: leftScene });
        const right = controller.saveVersion({ name: "Right", parentVersionId: root.id, scene: rightScene });
        const mergedA = controller.mergeVersions({ name: "Merged", baseVersionId: root.id, versionIds: [left.id, right.id] });
        const other = module.createSceneHistoryController(base);
        const oroot = other.saveVersion({ name: "Base", parentVersionId: null, scene: base });
        const oright = other.saveVersion({ name: "Right", parentVersionId: oroot.id, scene: rightScene });
        const oleft = other.saveVersion({ name: "Left", parentVersionId: oroot.id, scene: leftScene });
        const mergedB = other.mergeVersions({ name: "Merged", baseVersionId: oroot.id, versionIds: [oright.id, oleft.id] });
        let invalidBaseRejected = false;
        try {
            other.mergeVersions({ name: "Invalid base", baseVersionId: oleft.id, versionIds: [oleft.id, oright.id] });
        }
        catch {
            invalidBaseRejected = true;
        }
        return stableScene(mergedA.scene) === stableScene(mergedB.scene)
            && mergedA.scene.elements[0].x === 10
            && mergedA.scene.elements[0].y === 20
            && mergedA.scene.elements[0].fillColor === "red"
            && mergedA.scene.elements.map((element) => element.id).join(",") === "a,b,z"
            && mergedA.version?.id === mergedB.version?.id
            && stableScene(mergedA.version?.parentIds ?? mergedA.version?.parents) === stableScene(mergedB.version?.parentIds ?? mergedB.version?.parents)
            && invalidBaseRejected;
    });
    test("conflict-taxonomy", () => {
        const base = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [] }]);
        const conflictBase = module.createSceneHistoryController(base);
        const cb = conflictBase.saveVersion({ name: "B", parentVersionId: null, scene: base });
        const c1 = conflictBase.saveVersion({ name: "C1", parentVersionId: cb.id, scene: scene([{ ...base.elements[0], x: 1 }]) });
        const c2 = conflictBase.saveVersion({ name: "C2", parentVersionId: cb.id, scene: scene([{ ...base.elements[0], x: 2 }]) });
        const before = conflictBase.listVersions().length;
        const conflict = conflictBase.mergeVersions({ name: "Conflict", baseVersionId: cb.id, versionIds: [c1.id, c2.id] });
        const swappedConflict = conflictBase.mergeVersions({ name: "Conflict", baseVersionId: cb.id, versionIds: [c2.id, c1.id] });
        const noVersionBeforeResolution = conflictBase.listVersions().length === before;
        const conflictCase = (caseBase, leftScene, rightScene, prefix) => {
            const subject = module.createSceneHistoryController(caseBase);
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
        try {
            conflictBase.resolveMerge(conflict.mergeId, {});
        }
        catch {
            partialRejected = true;
        }
        const resolved = conflictBase.resolveMerge(conflict.mergeId, Object.fromEntries(conflict.conflicts.map((item) => [item.id, "left"])));
        return Array.isArray(conflict.conflicts)
            && conflict.conflicts.length > 0
            && noVersionBeforeResolution
            && conflict.mergeId === swappedConflict.mergeId
            && stableScene(conflict.conflicts.map((item) => item.id)) === stableScene(swappedConflict.conflicts?.map((item) => item.id))
            && modifyDelete.some((item) => item.kind === "modify-delete" || String(item.path).includes("/elements/a"))
            && divergentAdd.some((item) => String(item.path).includes("/elements/new"))
            && assetConflict.some((item) => String(item.path).includes("/files/f"))
            && arrayConflict.some((item) => String(item.path).includes("/groupIds"))
            && partialRejected && resolved.status === "merged" && conflictBase.listVersions().length === before + 1;
    });
    const relationCheck = (kind) => {
        const relationScene = scene([
            { id: "box", type: "rectangle", index: "a0", groupIds: ["g"], boundElements: [{ id: "arrow", type: "arrow" }] },
            { id: "arrow", type: "arrow", index: "a1", groupIds: ["g"], startBinding: { elementId: "box" }, endBinding: null },
            { id: "img", type: "image", index: "a2", groupIds: [], fileId: "f1" },
            { id: "frame", type: "frame", index: "a3", groupIds: [] },
            { id: "framed", type: "rectangle", index: "a4", groupIds: [], frameId: "frame" },
            { id: "text", type: "text", index: "a5", groupIds: [], containerId: "box" },
        ], { f1: { id: "f1", dataURL: "data:image/png;base64,AA==", mimeType: "image/png", created: 1 } });
        const rel = module.createSceneHistoryController(relationScene);
        const rv = rel.saveVersion({ name: "Relations", parentVersionId: null, scene: relationScene });
        const leftScene = scene(relationScene.elements.map((element) => element.id === "box" ? { ...element, x: 10 } : element), relationScene.files);
        const rightScene = scene(relationScene.elements.map((element) => element.id === "arrow" ? { ...element, y: 20 } : element), relationScene.files);
        const left = rel.saveVersion({ name: "Relation left", parentVersionId: rv.id, scene: leftScene });
        const right = rel.saveVersion({ name: "Relation right", parentVersionId: rv.id, scene: rightScene });
        rel.mergeVersions({ name: "Relation merge", baseVersionId: rv.id, versionIds: [left.id, right.id] });
        const checked = rel.getCurrentScene();
        let danglingRejected = false;
        try {
            rel.saveVersion({ name: "Dangling", parentVersionId: rv.id, scene: scene([{ id: "bad", index: "a0", groupIds: [], startBinding: { elementId: "missing" } }]) });
        }
        catch {
            danglingRejected = true;
        }
        return kind === "relationship"
            ? checked.elements.find((item) => item.id === "arrow")?.startBinding?.elementId === "box"
                && checked.elements.find((item) => item.id === "box")?.boundElements?.[0]?.id === "arrow"
                && checked.elements.find((item) => item.id === "framed")?.frameId === "frame"
                && checked.elements.find((item) => item.id === "text")?.containerId === "box" && danglingRejected
            : checked.elements.filter((item) => item.groupIds?.includes("g")).length === 2 && checked.files.f1?.dataURL.includes("AA==");
    };
    test("relationship-integrity", () => relationCheck("relationship"));
    test("groups-and-assets", () => relationCheck("assets"));
    test("undo-boundary", () => {
        const relationScene = scene([{ id: "a", x: 0, y: 0, index: "a0", groupIds: [] }]);
        const rel = module.createSceneHistoryController(relationScene);
        const rv = rel.saveVersion({ name: "Relations", parentVersionId: null, scene: relationScene });
        const movedRelationScene = scene(relationScene.elements.map((element) => ({ ...element, x: (element.x ?? 0) + 100 })), relationScene.files);
        const moved = rel.saveVersion({ name: "Moved relations", parentVersionId: rv.id, scene: movedRelationScene });
        const graphBeforeCheckout = stableScene(rel.listVersions());
        rel.checkout(rv.id);
        const afterCheckout = stableScene(rel.getCurrentScene());
        rel.undo();
        const afterUndo = stableScene(rel.getCurrentScene());
        rel.redo();
        const afterRedo = stableScene(rel.getCurrentScene());
        const mergeController = module.createSceneHistoryController(relationScene);
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
            && rel.listVersions().some((version) => version.id === moved.id)
            && stableScene(rel.listVersions()) === graphBeforeCheckout
            && afterMerge === stableScene(mergeResult.scene)
            && afterMergeUndo === stableScene(mergeRightScene)
            && afterMergeRedo === afterMerge
            && stableScene(mergeController.listVersions()) === mergeGraph;
    });
    test("export-boundary", () => {
        const base = scene([{ id: "img", type: "image", fileId: "f1", index: "a0", groupIds: [] }], { f1: { id: "f1", dataURL: "data:image/png;base64,AA==" } }, { viewBackgroundColor: "#ffffff", selectedElementIds: { img: true }, activeTool: { type: "rectangle" } });
        const rel = module.createSceneHistoryController(base);
        rel.saveVersion({ name: "Base", parentVersionId: null, scene: base });
        const ordinary = JSON.parse(rel.exportCurrentScene());
        const history = JSON.parse(rel.exportHistory());
        return ordinary.type === "excalidraw" && ordinary.history === undefined
            && ordinary.appState.viewBackgroundColor === "#ffffff" && ordinary.appState.selectedElementIds === undefined && ordinary.appState.activeTool === undefined
            && history.type === "excalidraw-scene-history" && history.schemaVersion === 1 && Array.isArray(history.versions) && history.versions.length === 1
            && Object.values(history.snapshots ?? {}).some((snapshot) => snapshot.files?.f1?.dataURL?.includes("AA=="));
    });
    test("historical-compatibility", () => {
        const restored = typeof module.importSceneHistory === "function" ? module.importSceneHistory(JSON.stringify({ type: "excalidraw", version: 1, elements: [{ id: "legacy", type: "rectangle", customFutureField: "keep" }], appState: {}, files: {} })) : null;
        const legacy = restored?.getCurrentScene?.();
        const restoredV2 = typeof module.importSceneHistory === "function" ? module.importSceneHistory(JSON.stringify({ type: "excalidraw", version: 2, elements: [{ id: "legacy-v2", type: "rectangle", anotherFutureField: 42 }], appState: {}, files: {} })) : null;
        const historySource = module.createSceneHistoryController(scene([{ id: "history", index: "a0", groupIds: [] }], { asset: { id: "asset", dataURL: "data:image/png;base64,AA==" } }));
        const historyRoot = historySource.saveVersion({ name: "History base", parentVersionId: null, scene: historySource.getCurrentScene() });
        historySource.saveVersion({ name: "History child", parentVersionId: historyRoot.id, scene: scene([{ id: "history", x: 1, index: "a0", groupIds: [] }], { asset: { id: "asset", dataURL: "data:image/png;base64,AA==" } }) });
        const importedHistory = module.importSceneHistory(historySource.exportHistory());
        let rejectsFuture = false;
        try {
            module.importSceneHistory?.(JSON.stringify({ type: "excalidraw-scene-history", schemaVersion: 2, versions: [] }));
        }
        catch {
            rejectsFuture = true;
        }
        return legacy?.elements?.[0]?.customFutureField === "keep"
            && restoredV2?.getCurrentScene?.().elements?.[0]?.anotherFutureField === 42
            && importedHistory.listVersions().length === 2
            && JSON.parse(importedHistory.exportHistory()).snapshots
            && rejectsFuture;
    });
    return checks;
}
function scene(elements, files = {}, appState = {}) { return { type: "excalidraw", version: 2, elements: structuredClone(elements), appState: structuredClone(appState), files: structuredClone(files) }; }
function stableScene(value) { return JSON.stringify(value, (_key, child) => child && typeof child === "object" && !Array.isArray(child) ? Object.fromEntries(Object.entries(child).sort(([a], [b]) => a.localeCompare(b))) : child); }
async function ensureCache(cacheDirectory, runCommand) {
    try {
        await access(cacheDirectory);
        await verifyUpstream(cacheDirectory, runCommand);
        return;
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
    await mkdir(dirname(cacheDirectory), { recursive: true, mode: 0o700 });
    const temporary = `${cacheDirectory}.tmp-${randomUUID()}`;
    await mkdir(temporary, { mode: 0o700 });
    try {
        await required(runCommand, "git", ["init", "--quiet"], temporary);
        await required(runCommand, "git", ["remote", "add", "origin", EXCALIDRAW_REPOSITORY_URL], temporary);
        await required(runCommand, "git", ["fetch", "--quiet", "--depth", "1", "origin", EXCALIDRAW_UPSTREAM_COMMIT], temporary);
        await required(runCommand, "git", ["checkout", "--quiet", "--detach", "FETCH_HEAD"], temporary);
        await verifyUpstream(temporary, runCommand);
        try {
            await rename(temporary, cacheDirectory);
        }
        catch (error) {
            if (!(error instanceof Error) || !["EEXIST", "ENOTEMPTY"].includes(error.code ?? ""))
                throw error;
            await verifyUpstream(cacheDirectory, runCommand);
        }
    }
    finally {
        await rm(temporary, { recursive: true, force: true });
    }
}
async function verifyUpstream(directory, runCommand) {
    const commit = (await required(runCommand, "git", ["rev-parse", "HEAD"], directory)).stdout.trim();
    const tree = (await required(runCommand, "git", ["rev-parse", "HEAD^{tree}"], directory)).stdout.trim();
    if (commit !== EXCALIDRAW_UPSTREAM_COMMIT || tree !== EXCALIDRAW_UPSTREAM_TREE)
        throw new Error(`Pinned Excalidraw source mismatch: ${commit}/${tree}.`);
    const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
    const license = await readFile(join(directory, "LICENSE"), "utf8");
    if (manifest.packageManager !== EXCALIDRAW_PACKAGE_MANAGER || manifest.engines?.node !== EXCALIDRAW_NODE_RANGE || !license.startsWith("MIT License\n"))
        throw new Error("Pinned Excalidraw environment or license does not match the fixture contract.");
}
async function seedCompatibility(directory) {
    const manifestPath = join(directory, "package.json");
    const lockPath = join(directory, "yarn.lock");
    await writeFile(manifestPath, seedExcalidrawCompatibilityManifest(await readFile(manifestPath, "utf8")), "utf8");
    await writeFile(lockPath, seedExcalidrawCompatibilityLock(await readFile(lockPath, "utf8")), "utf8");
}
async function verifySeeded(directory, runCommand) {
    const [commit, tree, parent] = await Promise.all([
        required(runCommand, "git", ["rev-parse", "HEAD"], directory),
        required(runCommand, "git", ["rev-parse", "HEAD^{tree}"], directory),
        required(runCommand, "git", ["rev-parse", "HEAD^"], directory),
    ]);
    if (commit.stdout.trim() !== EXCALIDRAW_SEEDED_COMMIT || tree.stdout.trim() !== EXCALIDRAW_SEEDED_TREE || parent.stdout.trim() !== EXCALIDRAW_UPSTREAM_COMMIT)
        throw new Error(`Seeded Excalidraw fixture identity mismatch: ${commit.stdout.trim()}/${tree.stdout.trim()}.`);
}
async function verifyQualificationAuthority(directory) {
    const mismatches = [];
    for (const entry of EXCALIDRAW_QUALIFICATION_AUTHORITY_V1.files) {
        const path = join(directory, entry.path);
        if (entry.digest === null) {
            try {
                await lstat(path);
                mismatches.push(entry.path);
            }
            catch (error) {
                if (!(error instanceof Error) || error.code !== "ENOENT")
                    throw error;
            }
            continue;
        }
        try {
            const [metadata, bytes] = await Promise.all([lstat(path), readFile(path)]);
            if (!metadata.isFile() || metadata.isSymbolicLink() || `sha256:${createHash("sha256").update(bytes).digest("hex")}` !== entry.digest)
                mismatches.push(entry.path);
        }
        catch (error) {
            if (error instanceof Error && error.code === "ENOENT")
                mismatches.push(entry.path);
            else
                throw error;
        }
    }
    return { passed: mismatches.length === 0, mismatches: Object.freeze(mismatches) };
}
class QualificationAuthorityError extends Error {
}
async function withPristineVerifierWorkspace(candidateDirectory, runCommand, verifyAuthority, verify) {
    const temporary = await mkdtemp(join(tmpdir(), "relayer-excalidraw-verifier-"));
    const verifierDirectory = join(temporary, "workspace");
    const patchPath = join(temporary, "candidate.patch");
    try {
        const patch = await required(runCommand, "git", ["diff", "--binary", `${EXCALIDRAW_SEEDED_COMMIT}..HEAD`, "--"], candidateDirectory);
        await writeFile(patchPath, patch.stdout, "utf8");
        await required(runCommand, "git", ["clone", "--local", "--no-hardlinks", "--no-checkout", candidateDirectory, verifierDirectory], temporary);
        await required(runCommand, "git", ["checkout", "--detach", EXCALIDRAW_SEEDED_COMMIT], verifierDirectory);
        if (patch.stdout)
            await required(runCommand, "git", ["apply", "--whitespace=nowarn", patchPath], verifierDirectory);
        const authority = await verifyAuthority(verifierDirectory);
        if (!authority.passed)
            throw new QualificationAuthorityError(`Candidate changed seeded qualification authority files: ${authority.mismatches.join(", ")}.`);
        await required(runCommand, "corepack", [EXCALIDRAW_PACKAGE_MANAGER, "install", "--frozen-lockfile", "--ignore-scripts", "--non-interactive"], verifierDirectory, { HUSKY: "0" });
        return await verify(verifierDirectory);
    }
    finally {
        await rm(temporary, { recursive: true, force: true });
    }
}
function hiddenVerifierSource() {
    const portable = evaluatePortableContract.toString();
    const sceneSource = scene.toString();
    const stable = stableScene.toString();
    return `import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import * as subject from "../index";
import { act, render as renderEditor } from "./test-utils";
import { API } from "./helpers/api";
import { Keyboard } from "./helpers/ui";
const VERIFIER_CHECKS=${JSON.stringify(VERIFIER_CHECKS)};
const evaluate=${portable};
const scene=${sceneSource};
const stableScene=${stable};
const checks=evaluate(subject,false);
const operation=({region,name,fields})=>{let scope=within(region);const first=scope.queryByLabelText(fields[0][0]);if(!first){fireEvent.click(scope.getByRole("button",{name}));scope=within(screen.getByRole("dialog",{name:new RegExp(name.split(" ")[0],"i")}));}for(const [label,value] of fields){fireEvent.change(scope.getByLabelText(label),{target:{value}});}fireEvent.click(scope.getByRole("button",{name}));};
describe("Relayer sealed scene-history contract",()=>{for(const check of checks.filter(({id})=>id!=="public-ui"&&id!=="undo-boundary"&&id!=="native-assets-appstate")){it(check.id,()=>expect(check.passed).toBe(true));}
it("public-ui",async()=>{let live=scene([{id:"a",x:0,y:0,index:"a0",groupIds:[],version:1}]);const captures=[];const editor={getSceneElements:()=>live.elements,getFiles:()=>live.files,getAppState:()=>live.appState,addFiles:(files)=>{live={...live,files:Object.fromEntries(files.map((file)=>[file.id,file]))};},updateScene:(update)=>{captures.push(update.captureUpdate);live={...live,elements:update.elements,appState:update.appState};}};const controller=subject.createSceneHistoryController(live,editor);let observedConflict=null;const uiController=Object.freeze({...controller,mergeVersions:(args)=>{const result=controller.mergeVersions(args);if(result.status==="conflicts")observedConflict=result;return result;}});render(React.createElement(subject.SceneHistoryPanel,{controller:uiController}));const region=screen.getByRole("region",{name:/scene history/i});expect(region).toBeTruthy();const blobs=[];const originalCreateObjectURL=URL.createObjectURL;URL.createObjectURL=(blob)=>{blobs.push(blob);return "blob:scene-history";};operation({region,name:"Save version",fields:[[/version name/i,"Base"]]});const base=controller.listVersions().find(({name})=>name==="Base");live=scene([{id:"a",x:10,y:0,index:"a0",groupIds:[],version:2}]);operation({region,name:"Save version",fields:[[/version name/i,"Left"]]});const left=controller.listVersions().find(({name})=>name==="Left");operation({region,name:"Checkout version",fields:[[/checkout version/i,base.id]]});live=scene([{id:"a",x:20,y:0,index:"a0",groupIds:[],version:3}]);operation({region,name:"Save version",fields:[[/version name/i,"Right"]]});const right=controller.listVersions().find(({name})=>name==="Right");expect(left.parentIds).toEqual([base.id]);expect(right.parentIds).toEqual([base.id]);operation({region,name:"Merge versions",fields:[[/merge name/i,"Merged"],[/merge base/i,base.id],[/first merge version/i,left.id],[/second merge version/i,right.id]]});const resolutionFields=screen.queryAllByLabelText(/resolution for/i);if(resolutionFields.length){for(const field of resolutionFields)fireEvent.change(field,{target:{value:"left"}});fireEvent.click(within(region).getByRole("button",{name:"Resolve conflicts"}));}else{fireEvent.click(within(region).getByRole("button",{name:"Resolve conflicts"}));const dialog=within(screen.getByRole("dialog",{name:/resolve/i}));for(const field of dialog.getAllByLabelText(/resolution for/i))fireEvent.change(field,{target:{value:"left"}});fireEvent.click(dialog.getByRole("button",{name:"Resolve conflicts"}));}const merged=controller.listVersions().find(({name})=>name==="Merged");expect([...merged.parentIds].sort()).toEqual([left.id,right.id].sort());const expectedChosen=observedConflict.conflicts.find(({path})=>path.endsWith("/x")).left;expect(controller.getCurrentScene().elements[0].x).toBe(expectedChosen);fireEvent.click(within(region).getByRole("button",{name:"Export history"}));const exportScope=screen.queryByRole("dialog",{name:/export/i});const scoped=exportScope?within(exportScope):within(region);const output=scoped.queryByLabelText(/exported history|history export/i);const link=scoped.queryByRole("link");let serialized=output?.value??output?.textContent??"";if(!serialized&&link?.href.startsWith("data:"))serialized=decodeURIComponent(link.href.split(",",2)[1]);if(!serialized&&blobs.length)serialized=await blobs.at(-1).text();URL.createObjectURL=originalCreateObjectURL;const exported=JSON.parse(serialized);expect(exported).toEqual(JSON.parse(controller.exportHistory()));expect(subject.importSceneHistory(serialized).exportHistory()).toBe(controller.exportHistory());expect(captures.every((value)=>value===subject.CaptureUpdateAction.IMMEDIATELY)).toBe(true);});
it("undo-boundary",async()=>{expect(checks.find(({id})=>id==="undo-boundary").passed).toBe(true);let editor;await renderEditor(React.createElement(subject.Excalidraw,{handleKeyboardGlobally:true,excalidrawAPI:(api)=>{editor=api;}}));expect(editor).toBeTruthy();const element=API.createElement({type:"rectangle",x:0,y:0});API.updateScene({elements:[element],captureUpdate:subject.CaptureUpdateAction.IMMEDIATELY});const controller=subject.createSceneHistoryController({elements:editor.getSceneElements(),files:editor.getFiles(),appState:{}},editor);const base=controller.saveVersion({name:"Base"});const beforeLeft=API.getUndoStack().length;API.updateScene({elements:[{...editor.getSceneElements()[0],x:10,version:editor.getSceneElements()[0].version+1,versionNonce:editor.getSceneElements()[0].versionNonce+1}],captureUpdate:subject.CaptureUpdateAction.IMMEDIATELY});await waitFor(()=>{expect(editor.getSceneElements()[0].x).toBe(10);expect(API.getUndoStack()).toHaveLength(beforeLeft+1);});const left=controller.saveVersion({name:"Left"});const beforeCheckout=API.getUndoStack().length;act(()=>controller.checkout(base.id));await waitFor(()=>{expect(editor.getSceneElements()[0].x).toBe(0);expect(API.getUndoStack()).toHaveLength(beforeCheckout+1);});document.querySelector(".excalidraw").focus();Keyboard.undo();await waitFor(()=>expect(editor.getSceneElements()[0].x).toBe(10));const beforeRight=API.getUndoStack().length;API.updateScene({elements:[{...editor.getSceneElements()[0],x:20,version:editor.getSceneElements()[0].version+1,versionNonce:editor.getSceneElements()[0].versionNonce+1}],captureUpdate:subject.CaptureUpdateAction.IMMEDIATELY});await waitFor(()=>{expect(editor.getSceneElements()[0].x).toBe(20);expect(API.getUndoStack()).toHaveLength(beforeRight+1);});const right=controller.saveVersion({name:"Right"});const beforePreMerge=API.getUndoStack().length;API.updateScene({elements:[{...editor.getSceneElements()[0],x:30,version:editor.getSceneElements()[0].version+1,versionNonce:editor.getSceneElements()[0].versionNonce+1}],captureUpdate:subject.CaptureUpdateAction.IMMEDIATELY});await waitFor(()=>{expect(editor.getSceneElements()[0].x).toBe(30);expect(API.getUndoStack()).toHaveLength(beforePreMerge+1);});const beforeMerge=API.getUndoStack().length;const preMergeX=editor.getSceneElements()[0].x;const conflict=controller.mergeVersions({name:"Merged",baseVersionId:base.id,versionIds:[left.id,right.id]});expect(conflict.status).toBe("conflicts");expect(editor.getSceneElements()[0].x).toBe(preMergeX);expect(API.getUndoStack()).toHaveLength(beforeMerge);const resolutions=Object.fromEntries(conflict.conflicts.map(({id})=>[id,"left"]));const expectedMergedX=conflict.conflicts.find(({path})=>path.endsWith("/x")).left;act(()=>controller.resolveMerge(conflict.mergeId,resolutions));await waitFor(()=>{expect(editor.getSceneElements()[0].x).toBe(expectedMergedX);expect(API.getUndoStack()).toHaveLength(beforeMerge+1);});const graph=controller.exportHistory();document.querySelector(".excalidraw").focus();Keyboard.undo();await waitFor(()=>expect(editor.getSceneElements()[0].x).toBe(preMergeX));expect(controller.exportHistory()).toBe(graph);});
it("native-assets-appstate",async()=>{let editor;await renderEditor(React.createElement(subject.Excalidraw,{handleKeyboardGlobally:true,excalidrawAPI:(api)=>{editor=api;}}));const image=API.createElement({type:"image",fileId:"shared-file",x:0,y:0,width:20,height:20});const existing={id:"shared-file",dataURL:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",mimeType:"image/png",created:1,lastRetrieved:1};editor.addFiles([existing]);API.updateScene({elements:[image],appState:{viewBackgroundColor:"#ffffff"},captureUpdate:subject.CaptureUpdateAction.IMMEDIATELY});const targetFile={...existing,dataURL:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYPj/HwADAgH/5ncLrgAAAABJRU5ErkJggg=="};const target={elements:[image],files:{"shared-file":targetFile},appState:{viewBackgroundColor:"#ff0000"}};const controller=subject.createSceneHistoryController(target,editor);const version=controller.saveVersion({name:"Asset target",scene:target});const graph=controller.exportHistory();const before=API.getUndoStack().length;act(()=>controller.checkout(version.id));await waitFor(()=>{const displayed=editor.getSceneElements()[0];expect(displayed.fileId).not.toBe("shared-file");expect(editor.getFiles()[displayed.fileId].dataURL).toBe(targetFile.dataURL);expect(editor.getAppState().viewBackgroundColor).toBe("#ff0000");expect(API.getUndoStack()).toHaveLength(before+1);});expect(controller.exportHistory()).toBe(graph);const branch=controller.saveVersion({name:"Alias branch"});const branchGraph=JSON.parse(controller.exportHistory());expect(branchGraph.snapshots[branch.id].elements[0].fileId).toBe("shared-file");expect(branchGraph.snapshots[branch.id].files["shared-file"].dataURL).toBe(targetFile.dataURL);const graphAfterBranch=controller.exportHistory();document.querySelector(".excalidraw").focus();Keyboard.undo();await waitFor(()=>{expect(editor.getSceneElements()[0].fileId).toBe("shared-file");expect(editor.getAppState().viewBackgroundColor).toBe("#ffffff");});expect(controller.exportHistory()).toBe(graphAfterBranch);});});
`;
}
function parseBehaviorChecks(result) {
    const candidates = [result.stdout, ...result.stdout.split("\n").filter((line) => line.trimStart().startsWith("{"))];
    for (const candidate of candidates)
        try {
            const report = JSON.parse(candidate);
            const assertions = (report.testResults ?? []).flatMap((file) => file.assertionResults ?? []);
            const checks = new Map();
            let invalid = (report.unhandledErrors?.length ?? 0) > 0
                || (report.numRuntimeErrors ?? 0) > 0
                || (report.numRuntimeErrorTestSuites ?? 0) > 0;
            for (const assertion of assertions) {
                if (!assertion.title || !VERIFIER_CHECKS.includes(assertion.title) || checks.has(assertion.title) || !["passed", "failed"].includes(assertion.status ?? "")) {
                    invalid = true;
                    break;
                }
                checks.set(assertion.title, assertion.status === "passed");
            }
            const expectedExitCode = [...checks.values()].some((passed) => !passed) ? 1 : 0;
            if (!invalid && checks.size === VERIFIER_CHECKS.length && result.exitCode === expectedExitCode)
                return checks;
        }
        catch { /* non-JSON command output is represented by the command result */ }
    return new Map();
}
function replaceOnce(source, search, replacement) {
    if (source.split(search).length !== 2)
        throw new Error("Pinned Excalidraw source no longer matches the compatibility seed contract.");
    return source.replace(search, replacement);
}
function assertSupportedNode(version) { const major = Number(version.split(".")[0]); if (major < 18 || major > 22)
    throw new Error(`The pinned Excalidraw fixture requires Node ${EXCALIDRAW_NODE_RANGE}; received ${version}.`); }
async function requireMissing(path, label) { try {
    await access(path);
}
catch (error) {
    if (error.code === "ENOENT")
        return;
    throw error;
} throw new Error(`Refusing to overwrite existing ${label}: ${path}`); }
function lines(value) { return value.split("\n").map((line) => line.trim()).filter(Boolean); }
function commandDetail(label, result) { return `${label} exited ${result.exitCode}.${result.stderr.trim() ? ` stderr: ${result.stderr.trim().slice(0, 1000)}` : ""}${result.stdout.trim() ? ` stdout: ${result.stdout.trim().slice(0, 1000)}` : ""}`; }
function fixtureCommitEnvironment() { return { ...Object.fromEntries(Object.entries(process.env).filter((entry) => entry[1] !== undefined)), GIT_AUTHOR_NAME: "Relayer Eval Fixture", GIT_AUTHOR_EMAIL: "eval-fixture@relayer.local", GIT_AUTHOR_DATE: "2026-08-28T12:00:00Z", GIT_COMMITTER_NAME: "Relayer Eval Fixture", GIT_COMMITTER_EMAIL: "eval-fixture@relayer.local", GIT_COMMITTER_DATE: "2026-08-28T12:00:00Z" }; }
async function required(runCommand, command, args, cwd, env) { const result = await runCommand(command, args, { cwd, ...(env ? { env: { ...process.env, ...env } } : {}) }); if (result.exitCode !== 0)
    throw new Error(`${command} ${args.join(" ")} failed (${result.exitCode}): ${result.stderr.trim() || result.stdout.trim()}`); return result; }
const run = (command, args, options) => new Promise((resolve, reject) => { const child = spawn(command, [...args], { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; child.stdout.on("data", (chunk) => { stdout += String(chunk); }); child.stderr.on("data", (chunk) => { stderr += String(chunk); }); child.once("error", reject); child.once("close", (code) => resolve({ exitCode: code ?? 1, stdout, stderr })); });
