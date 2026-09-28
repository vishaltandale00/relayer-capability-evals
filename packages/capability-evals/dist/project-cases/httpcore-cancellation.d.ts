import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
export declare const HTTPCORE_CANCELLATION_CASE_ID = "autonomous.httpcore.cancellation-poisoned-pool";
export declare const HTTPCORE_REPOSITORY_URL = "https://github.com/encode/httpcore.git";
export declare const HTTPCORE_UPSTREAM_COMMIT = "79fa6bf0dfcf3820d1ae7e52a2d268f33022c5a4";
export declare const HTTPCORE_UPSTREAM_TREE = "834aaf7041c78aa49597e691e6ce9fc41d6c0bc6";
export declare const HTTPCORE_PYTHON_VERSION = "3.12.2";
export declare const HTTPCORE_LICENSE = "BSD-3-Clause";
export declare const HTTPCORE_UV_VERSION = "0.12.0";
export declare const HTTPCORE_VERIFIER_SOURCE_SHA256 = "30114b26b485248029809d104b8fda23f0ad39cb5b3bf96f7a407edf60c475a6";
declare const AUTHORITY_BOUNDARY = "Behavioral verifier admission is not a security sandbox for arbitrarily hostile candidate code executing inside the Python worker.";
declare const UNRESOLVED_FINDINGS: readonly string[];
export interface HTTPCoreCaseDefinition {
    readonly schemaVersion: 1;
    readonly id: typeof HTTPCORE_CANCELLATION_CASE_ID;
    readonly name: string;
    readonly description: string;
    readonly localOnly: true;
    readonly supportedPlatform: "darwin";
    readonly autonomous: true;
    readonly category: "coding";
    readonly taskType: "debugging";
    readonly fixture: {
        readonly repositoryUrl: typeof HTTPCORE_REPOSITORY_URL;
        readonly upstreamCommit: typeof HTTPCORE_UPSTREAM_COMMIT;
        readonly upstreamTree: typeof HTTPCORE_UPSTREAM_TREE;
        readonly packageManager: "uv";
        readonly python: typeof HTTPCORE_PYTHON_VERSION;
        readonly license: typeof HTTPCORE_LICENSE;
    };
    readonly threads: readonly ProjectEvalThreadDefinition[];
}
export declare const httpcoreCancellationEvalCase: HTTPCoreCaseDefinition;
export declare const httpcoreCancellationCase: import("@relayer/eval-runner").BoundAutonomousCase<HTTPCoreCaseDefinition>;
export declare const httpcoreCancellationCases: readonly import("@relayer/eval-runner").BoundAutonomousCase<HTTPCoreCaseDefinition>[];
export declare const httpcoreCancellationCaseIds: Set<string>;
export interface HTTPCoreFixtureReceipt {
    readonly schemaVersion: 1;
    readonly fixtureId: typeof HTTPCORE_CANCELLATION_CASE_ID;
    readonly workspaceDirectory: string;
    readonly environmentDirectory: string;
    readonly pythonExecutable: string;
    readonly repositoryUrl: typeof HTTPCORE_REPOSITORY_URL;
    readonly upstreamCommit: typeof HTTPCORE_UPSTREAM_COMMIT;
    readonly seededTree: typeof HTTPCORE_UPSTREAM_TREE;
    readonly sourceRevision: `git-tree:${typeof HTTPCORE_UPSTREAM_TREE}`;
    readonly pythonVersion: typeof HTTPCORE_PYTHON_VERSION;
    readonly requirementsDigest: `sha256:${string}`;
    readonly environmentDigest: `sha256:${string}`;
    readonly uvVersion: typeof HTTPCORE_UV_VERSION;
    readonly installedWithFrozenLockfile: true;
}
export declare function materializeHTTPCoreCancellationFixture(options: {
    readonly cacheDirectory: string;
    readonly workspaceDirectory: string;
    readonly environmentDirectory?: string;
    readonly platform?: NodeJS.Platform;
    readonly runCommand?: CommandRunner;
}): Promise<HTTPCoreFixtureReceipt>;
export declare function gradeHTTPCoreCancellationWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly pythonExecutable?: string;
    readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]>;
export interface HTTPCoreAdmissionReceipt {
    readonly schemaVersion: 1;
    readonly caseId: typeof HTTPCORE_CANCELLATION_CASE_ID;
    readonly source: {
        readonly commit: typeof HTTPCORE_UPSTREAM_COMMIT;
        readonly tree: typeof HTTPCORE_UPSTREAM_TREE;
        readonly license: typeof HTTPCORE_LICENSE;
    };
    readonly environment: {
        readonly python: typeof HTTPCORE_PYTHON_VERSION;
        readonly uv: typeof HTTPCORE_UV_VERSION;
        readonly requirementsDigest: `sha256:${string}`;
    };
    readonly verifierDigest: `sha256:${string}`;
    readonly authorityBoundary: typeof AUTHORITY_BOUNDARY;
    readonly unresolvedFindings: typeof UNRESOLVED_FINDINGS;
    readonly result: "pass" | "fail";
    readonly variants: readonly {
        readonly id: string;
        readonly expected: "red" | "green";
        readonly actual: "red" | "green";
        readonly patchDigest: `sha256:${string}` | null;
        readonly failedChecks: readonly string[];
    }[];
}
export declare function runHTTPCoreAdmissionPortfolio(options: {
    readonly cacheDirectory: string;
    readonly rootDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly runCommand?: CommandRunner;
}): Promise<HTTPCoreAdmissionReceipt>;
export {};
