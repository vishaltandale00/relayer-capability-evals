import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
export declare const JUPYTERLAB_EXECUTION_BUNDLES_CASE_ID: "jupyterlab.reproducible-execution-bundles";
export declare const JUPYTERLAB_REPOSITORY_URL: "https://github.com/jupyterlab/jupyterlab.git";
export declare const JUPYTERLAB_UPSTREAM_COMMIT: "9a217d024d13ef82c8de060a9fed8b430d28424a";
export declare const JUPYTERLAB_UPSTREAM_TREE: "f75d058600de259d858001471410d67729405070";
export declare const JUPYTERLAB_PACKAGE_MANAGER: "yarn@3.5.0-repository-runtime";
export declare const JUPYTERLAB_NODE_RANGE: "22.23.2";
export declare const JUPYTERLAB_YARN_LOCK_SHA256: "5898a92ef8e6a945267e7008d5dbd1a837507c5582bea0575610daec70d52656";
export declare const JUPYTERLAB_YARN_RUNTIME_SHA256: "e4fc5f94867cd0b492fb0a644f14e7b47c4387bc75d46b56e86db6d0f1a6cb97";
export declare const JUPYTERLAB_YARNRC_SHA256: "2c0b85ab0efb4dd97c5720d1f31244b60564fceda112d32d6cdc5a2b8a5d5e86";
export declare const JUPYTERLAB_EXECUTION_BUNDLES_VERIFIER_SOURCE_SHA256 = "b09bfec865c29fecf291f493c8d4832c409bdc029cb869c0fe6285f7edda5284";
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
export declare const jupyterLabExecutionBundlesEvalCase: JupyterLabExecutionBundlesCaseDefinition;
export declare const jupyterLabExecutionBundlesCase: import("@relayer/eval-runner").BoundAutonomousCase<JupyterLabExecutionBundlesCaseDefinition>;
export declare const jupyterLabExecutionBundlesCases: readonly import("@relayer/eval-runner").BoundAutonomousCase<JupyterLabExecutionBundlesCaseDefinition>[];
export declare const jupyterLabExecutionBundlesCaseIds: Set<"jupyterlab.reproducible-execution-bundles">;
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
export declare function materializeJupyterLabExecutionBundlesFixture(options: {
    readonly cacheDirectory: string;
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly nodeVersion?: string;
    readonly runCommand?: CommandRunner;
}): Promise<JupyterLabFixtureReceipt>;
export declare function gradeJupyterLabExecutionBundlesWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly runCommand?: CommandRunner;
    /** Test-only: synthetic unit fixtures have no pinned Git repository to rematerialize. */
    readonly testOnlyUseCandidateWorkspace?: boolean;
}): Promise<readonly EvalCheck[]>;
export declare function jupyterLabExecutionBundlesVerifierDigest(): `sha256:${string}`;
