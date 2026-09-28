import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner } from "@relayer/eval-runner";
export declare const EXCALIDRAW_SCENE_HISTORY_CASE_ID = "autonomous.excalidraw.scene-history";
export declare const EXCALIDRAW_REPOSITORY_URL = "https://github.com/excalidraw/excalidraw.git";
export declare const EXCALIDRAW_UPSTREAM_COMMIT = "a2ec2889babf7d2295469c6d90ebe77fae57df84";
export declare const EXCALIDRAW_UPSTREAM_TREE = "d3311e5625898710e0479761bcff509a2e4e6ee9";
export declare const EXCALIDRAW_SEEDED_COMMIT = "c52dec55d5ee55d0b7ab4490c0ae2ea972677a04";
export declare const EXCALIDRAW_SEEDED_TREE = "c012bac05bc9ff960878600eca11a39eda226037";
export declare const EXCALIDRAW_PACKAGE_MANAGER = "yarn@1.22.22";
export declare const EXCALIDRAW_NODE_RANGE = "18.0.0 - 22.x.x";
export declare const EXCALIDRAW_SEED_MESSAGE = "Seed reproducible Excalidraw declaration build";
export declare const EXCALIDRAW_EXPECTED_RUNTIME_SECONDS: Readonly<{
    install: 120;
    packageBuild: 30;
    focusedTests: 60;
}>;
export declare const EXCALIDRAW_VERIFIER_SOURCE_SHA256 = "3b511717909c24f044513c39b722e25a90472a8254a2e4ef38da931bc33ea8ea";
export declare const EXCALIDRAW_QUALIFICATION_AUTHORITY_V1: Readonly<{
    id: "excalidraw-scene-history-qualification-authority-v1";
    seededCommit: "c52dec55d5ee55d0b7ab4490c0ae2ea972677a04";
    files: readonly (Readonly<{
        path: "package.json";
        digest: "sha256:af667c09b686361d0016b68ae7052a89ac56f0716735c0ec902fa56aca8735ab";
    }> | Readonly<{
        path: "yarn.lock";
        digest: "sha256:ce8b2dd86356140d4d12700f75d0de9fcf91b9ed8d70547834c805b3b113bec2";
    }> | Readonly<{
        path: "vitest.config.mts";
        digest: "sha256:36af77c8c95f53a5946289a1ceac2c9b3c96c25a23639b7a8f79526b129bb002";
    }> | Readonly<{
        path: "setupTests.ts";
        digest: "sha256:edf1c801973fa6fa27dc4f383491a4a3ce64042d2389aa6afa8258d443d62ffb";
    }> | Readonly<{
        path: "packages/excalidraw/package.json";
        digest: "sha256:402f54fc7de128b25d22bd4d905fb46dbcdbe2ce6efee567d4da0fc79a29aab1";
    }> | Readonly<{
        path: "packages/excalidraw/tsconfig.json";
        digest: "sha256:2ca485bc01425b542b3eef10d615c269f6b6448d12bc4523e430a705e037b968";
    }> | Readonly<{
        path: "scripts/buildPackage.js";
        digest: "sha256:bbacb59e932431ec3dcf1b99b3d41253dbed2fc30391a07793d21f2d819834bd";
    }> | Readonly<{
        path: ".npmrc";
        digest: "sha256:5435eb27737e90ee4adccbe4626aeb2bb6152f76872d9dbabb3e5483aa6da44f";
    }> | Readonly<{
        path: "tsconfig.json";
        digest: "sha256:1cc235e789b858eb3fd133a1bb3e98ff20c22d3c0eb8eacb873454435bb25138";
    }> | Readonly<{
        path: ".yarnrc";
        digest: null;
    }> | Readonly<{
        path: ".yarnrc.yml";
        digest: null;
    }>)[];
    paths: readonly string[];
}>;
export declare function excalidrawVerifierDigest(): `sha256:${string}`;
export declare const excalidrawSceneHistoryCase: import("@relayer/eval-runner").BoundAutonomousCase<Readonly<{
    schemaVersion: 1;
    id: "autonomous.excalidraw.scene-history";
    name: "Excalidraw · branching scene history";
    description: "Adds immutable named scene versions, historical branching, deterministic merge, surfaced conflicts, and durable history export to a frozen Excalidraw repository.";
    localOnly: true;
    supportedPlatform: "darwin";
    autonomous: true;
    category: "coding";
    taskType: "feature-change";
    fixture: Readonly<{
        repositoryUrl: "https://github.com/excalidraw/excalidraw.git";
        upstreamCommit: "a2ec2889babf7d2295469c6d90ebe77fae57df84";
        upstreamTree: "d3311e5625898710e0479761bcff509a2e4e6ee9";
        seededCommit: "c52dec55d5ee55d0b7ab4490c0ae2ea972677a04";
        seededTree: "c012bac05bc9ff960878600eca11a39eda226037";
        packageManager: "yarn@1.22.22";
        node: "18.0.0 - 22.x.x";
        license: "MIT";
        expectedRuntimeSeconds: Readonly<{
            install: 120;
            packageBuild: 30;
            focusedTests: 60;
        }>;
    }>;
    threads: readonly Readonly<{
        id: "implementation";
        name: "Build branching scene history";
        permissionProfileId: "full";
        mutationPolicy: "writable";
        workspaceGrade: "autonomous-implementation";
        prompts: readonly string[];
    }>[];
}>>;
export declare function seedExcalidrawCompatibilityManifest(source: string): string;
export declare function seedExcalidrawCompatibilityLock(source: string): string;
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
export declare function materializeExcalidrawSceneHistoryFixture(options: {
    readonly cacheDirectory: string;
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly nodeVersion?: string;
    readonly runCommand?: CommandRunner;
}): Promise<ExcalidrawFixtureReceipt>;
export declare function gradeExcalidrawSceneHistoryWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly runCommand?: CommandRunner;
    readonly qualificationAuthorityVerifier?: (directory: string) => Promise<{
        passed: boolean;
        mismatches: readonly string[];
    }>;
}): Promise<readonly EvalCheck[]>;
export interface PortableAdmissionPortfolioEntry {
    readonly id: string;
    readonly expectation: "red" | "green" | "mutant";
    readonly modulePath?: string;
}
export declare function runExcalidrawPortablePortfolio(options: {
    readonly fixtureDirectory: string;
    readonly entries: readonly PortableAdmissionPortfolioEntry[];
}): Promise<{
    admitted: boolean;
    entries: {
        id: string;
        expectation: "red" | "green" | "mutant";
        passed: boolean;
        checks: {
            id: string;
            passed: boolean;
        }[];
    }[];
}>;
export interface ExcalidrawPatchAdmissionEntry {
    readonly id: string;
    readonly expectation: "red" | "green" | "mutant";
    readonly patchPaths: readonly string[];
    readonly expectedFailedChecks?: readonly string[];
}
export declare const EXCALIDRAW_ADMISSION_PORTFOLIO_V1: Readonly<{
    id: "excalidraw-scene-history-admission-v1";
    baselineId: "untouched";
    greenIds: readonly string[];
    mutantIds: readonly string[];
    expectedFailures: Readonly<{
        untouched: readonly string[];
        "mutant-forged-verdict": readonly string[];
        "mutant-forged-runner": readonly string[];
        "mutant-forged-yarnrc": readonly string[];
        "mutant-ui-inert": readonly string[];
        "mutant-ui-miswired": readonly string[];
        "mutant-branch-overwrite": readonly string[];
        "mutant-silent-lww": readonly string[];
        "mutant-relationships": readonly string[];
        "mutant-undo": readonly string[];
        "mutant-history-loss": readonly string[];
    }>;
}>;
export declare function runExcalidrawAdmissionPortfolio(options: {
    readonly fixtureDirectory: string;
    readonly entries: readonly ExcalidrawPatchAdmissionEntry[];
    readonly portfolioId?: typeof EXCALIDRAW_ADMISSION_PORTFOLIO_V1.id;
    readonly artifactsDirectory?: string;
    readonly runCommand?: CommandRunner;
    readonly gradeWorkspace?: typeof gradeExcalidrawSceneHistoryWorkspace;
}): Promise<{
    portfolioId: "excalidraw-scene-history-admission-v1" | null;
    admitted: boolean;
    entries: {
        id: string;
        expectation: ExcalidrawPatchAdmissionEntry["expectation"];
        passed: boolean;
        checks: readonly EvalCheck[];
        verdictDetail: string;
        inputDigests: string[];
    }[];
}>;
