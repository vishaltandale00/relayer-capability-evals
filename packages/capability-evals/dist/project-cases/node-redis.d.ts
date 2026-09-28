import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
export declare const NODE_REDIS_COMMAND_QUEUE_RACE_CASE_ID = "autonomous.node-redis.command-queue-race";
export declare const NODE_REDIS_REPOSITORY_URL = "https://github.com/redis/node-redis.git";
export declare const NODE_REDIS_UPSTREAM_TAG_OBJECT = "115b11829508162bf0776c68500b87de08d52560";
export declare const NODE_REDIS_UPSTREAM_COMMIT = "4f85030e42da2eed6a178e54994330af5062761e";
export declare const NODE_REDIS_UPSTREAM_TREE = "3a360d5440b2d73831123df48e24b3422676bb16";
declare const NODE_REDIS_NODE_VERSION = "22.23.2";
declare const NODE_REDIS_NPM_VERSION = "10.9.8";
declare const NODE_REDIS_ARCHITECTURE = "arm64";
export declare const NODE_REDIS_VERIFIER_PREDICATE_IDS: readonly ["fault-injection-observed", "failed-command-rejected-once", "queue-clean-before-reconnect", "reconnect-reply-order", "offline-queue-replayed-in-order", "reconnect-queue-drained", "single-failure-callbacks-settle", "repeated-faults-observed", "fault-command-matrix-observed", "repeated-failures-rejected-independently", "repeated-reconnects-start-clean", "ordered-replies-after-recovery", "no-command-reply-misassociation", "callbacks-settle-without-hang", "client-reply-modes-preserved"];
export interface NodeRedisCaseDefinition {
    readonly schemaVersion: 1;
    readonly id: typeof NODE_REDIS_COMMAND_QUEUE_RACE_CASE_ID;
    readonly name: string;
    readonly description: string;
    readonly localOnly: true;
    readonly supportedPlatform: "darwin";
    readonly autonomous: true;
    readonly category: "coding";
    readonly taskType: "debugging";
    readonly fixture: {
        readonly repositoryUrl: typeof NODE_REDIS_REPOSITORY_URL;
        readonly upstreamTagObject: typeof NODE_REDIS_UPSTREAM_TAG_OBJECT;
        readonly upstreamCommit: typeof NODE_REDIS_UPSTREAM_COMMIT;
        readonly upstreamTree: typeof NODE_REDIS_UPSTREAM_TREE;
        readonly node: typeof NODE_REDIS_NODE_VERSION;
        readonly packageManager: "npm@10.9.8";
        readonly license: "MIT";
    };
    readonly threads: readonly ProjectEvalThreadDefinition[];
}
export declare const nodeRedisCommandQueueRaceDefinition: NodeRedisCaseDefinition;
export declare function nodeRedisVerifierDigest(): `sha256:${string}`;
export declare const nodeRedisCommandQueueRaceCase: import("@relayer/eval-runner").BoundAutonomousCase<NodeRedisCaseDefinition>;
export declare const nodeRedisAutonomousCases: readonly import("@relayer/eval-runner").BoundAutonomousCase<NodeRedisCaseDefinition>[];
export declare const nodeRedisAutonomousCaseIds: Set<string>;
export interface NodeRedisFixtureReceipt {
    readonly schemaVersion: 1;
    readonly fixtureId: typeof NODE_REDIS_COMMAND_QUEUE_RACE_CASE_ID;
    readonly workspaceDirectory: string;
    readonly repositoryUrl: typeof NODE_REDIS_REPOSITORY_URL;
    readonly upstreamCommit: typeof NODE_REDIS_UPSTREAM_COMMIT;
    readonly upstreamTree: typeof NODE_REDIS_UPSTREAM_TREE;
    readonly sourceRevision: `git-tree:${typeof NODE_REDIS_UPSTREAM_TREE}`;
    readonly nodeVersion: typeof NODE_REDIS_NODE_VERSION;
    readonly npmVersion: typeof NODE_REDIS_NPM_VERSION;
    readonly architecture: typeof NODE_REDIS_ARCHITECTURE;
    readonly packageManager: "npm@10.9.8";
    readonly environmentDigest: `sha256:${string}`;
    readonly installedExactRuntimeDependencies: true;
}
export declare function materializeNodeRedisProjectFixture(options: {
    readonly cacheDirectory: string;
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly architecture?: string;
    readonly nodeVersion?: string;
    readonly npmVersion?: string;
    readonly runCommand?: CommandRunner;
}): Promise<NodeRedisFixtureReceipt>;
export declare function gradeNodeRedisWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]>;
export {};
