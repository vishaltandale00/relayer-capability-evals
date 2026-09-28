import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
export declare const TOURNAMENT_OPERATIONS_CASE_ID = "capability.greenfield.tournament-operations";
export interface TournamentOperationsCaseDefinition {
    readonly schemaVersion: 1;
    readonly id: typeof TOURNAMENT_OPERATIONS_CASE_ID;
    readonly name: string;
    readonly description: string;
    readonly localOnly: true;
    readonly supportedPlatform: "darwin";
    readonly autonomous: true;
    readonly category: "coding";
    readonly taskType: "greenfield-build";
    readonly fixture: {
        readonly source: string;
        readonly revision: string;
        readonly packageManager: "node@22";
    };
    readonly threads: readonly ProjectEvalThreadDefinition[];
}
type TournamentApi = Readonly<Record<"createTournament" | "recordResult" | "withdrawTeam" | "rescheduleMatch", (...args: any[]) => any>>;
type PredicateResult = {
    readonly id: string;
    readonly passed: boolean;
    readonly detail: string;
};
export declare const TOURNAMENT_VERIFIER_GATE_CHECKS: Readonly<{
    readonly "tournament-core": readonly string[];
    readonly "schedule-operations": readonly string[];
    readonly "operator-interface": readonly string[];
    readonly "tournament-scoped-commit": readonly string[];
}>;
export declare const tournamentOperationsCaseDefinition: TournamentOperationsCaseDefinition;
export declare const tournamentVerifierManifestContents = "{\n  \"schemaVersion\": 1,\n  \"verifierId\": \"tournament-operations-v2\",\n  \"logicalContentDigest\": \"sha256:99726ebc46af392fa7ce6d026cb28e0d7de735d71c27a003c9630cbd02c9be2a\",\n  \"behavioralVerifierSourceDigest\": \"sha256:4c7bd3f986a5b4b166400e56cf3a2e4e46d3a46075655ff0efc0432161826e81\",\n  \"serviceIntegrationSourceDigest\": \"sha256:ea19c45d85e28a8c14471ac6059a41af3e9fd470df7bc42d63f09165e5447f49\",\n  \"operatorInterfaceVerifierDigest\": \"sha256:0b237f2b74ee0041271ff183fe0adb8c080f59b4d7a6259ca964bf1929f8b2aa\",\n  \"gateChecks\": {\n    \"tournament-core\": [\n      \"snapshot-schema\",\n      \"registration-uniqueness\",\n      \"configuration-matrix\",\n      \"seeding-determinism\",\n      \"pool-round-robin\",\n      \"results-validation\",\n      \"results-integer-boundary\",\n      \"standings-points\",\n      \"tiebreak-head-to-head\",\n      \"tiebreak-differential-seed\",\n      \"advancement-pool-qualifiers\",\n      \"bracket-progression\"\n    ],\n    \"schedule-operations\": [\n      \"schedule-venue-boundaries\",\n      \"schedule-collision-free\",\n      \"schedule-infeasible\",\n      \"elimination-schedule\",\n      \"withdrawal-cancellation\",\n      \"withdrawal-eligibility\",\n      \"reschedule-collision\",\n      \"reschedule-window\",\n      \"reschedule-terminal\",\n      \"reschedule-valid-free-slot\",\n      \"json-compatible-snapshots\"\n    ],\n    \"operator-interface\": [\n      \"operator-interface\"\n    ],\n    \"tournament-scoped-commit\": [\n      \"visible-contract\",\n      \"required-deliverables\",\n      \"delivery-commit\",\n      \"delivery-clean\"\n    ]\n  }\n}\n";
export declare const tournamentOperationsCase: import("@relayer/eval-runner").BoundAutonomousCase<TournamentOperationsCaseDefinition>;
export declare const tournamentOperationsCaseIds: Set<string>;
export interface TournamentFixtureReceipt {
    readonly schemaVersion: 1;
    readonly fixtureId: typeof TOURNAMENT_OPERATIONS_CASE_ID;
    readonly workspaceDirectory: string;
    readonly repositoryUrl: string;
    readonly sourceRevision: string;
    readonly seededCommit: string;
    readonly seededTree: string;
    readonly packageManager: "node@22";
    readonly installedWithFrozenLockfile: false;
}
export declare function materializeTournamentOperationsFixture(options: {
    readonly caseId: typeof TOURNAMENT_OPERATIONS_CASE_ID;
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly runCommand?: CommandRunner;
}): Promise<TournamentFixtureReceipt>;
export declare function verifyTournamentPublicSeam(api: Partial<TournamentApi>): Promise<readonly PredicateResult[]>;
export declare function gradeTournamentOperationsWorkspace(options: {
    readonly caseId: typeof TOURNAMENT_OPERATIONS_CASE_ID;
    readonly workspaceDirectory: string;
    readonly baseRevision?: string;
    readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]>;
export {};
