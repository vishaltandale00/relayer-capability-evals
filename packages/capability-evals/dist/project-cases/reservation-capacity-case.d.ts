import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
export declare const RESERVATION_CAPACITY_CASE_ID = "capability.greenfield.reservation-capacity";
export type ReservationCapacityCaseId = typeof RESERVATION_CAPACITY_CASE_ID;
export declare const reservationCapacityGateCheckPatterns: Readonly<Record<string, readonly string[]>>;
export interface ReservationCapacityCaseDefinition {
    readonly schemaVersion: 1;
    readonly id: ReservationCapacityCaseId;
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
export declare const reservationCapacityCase: import("@relayer/eval-runner").BoundAutonomousCase<ReservationCapacityCaseDefinition>;
export declare const reservationCapacityCases: readonly import("@relayer/eval-runner").BoundAutonomousCase<ReservationCapacityCaseDefinition>[];
export declare const reservationCapacityCaseIds: Set<"capability.greenfield.reservation-capacity">;
export interface ReservationCapacityFixtureReceipt {
    readonly schemaVersion: 1;
    readonly fixtureId: ReservationCapacityCaseId;
    readonly workspaceDirectory: string;
    readonly repositoryUrl: string;
    readonly sourceRevision: string;
    readonly seededCommit: string;
    readonly seededTree: string;
    readonly packageManager: "node@22";
    readonly installedWithFrozenLockfile: false;
    readonly sourceContentDigest: `sha256:${string}`;
    readonly environmentDigest: `sha256:${string}`;
}
export declare function materializeReservationCapacityFixture(options: {
    readonly caseId: ReservationCapacityCaseId;
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly runtimeNodeVersion?: string;
    readonly runCommand?: CommandRunner;
}): Promise<ReservationCapacityFixtureReceipt>;
export declare function gradeReservationCapacityWorkspace(options: {
    readonly caseId: ReservationCapacityCaseId;
    readonly workspaceDirectory: string;
    readonly baseRevision?: string;
    readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]>;
export declare function reservationCapacityVerifierSourceDigest(source: string): `sha256:${string}`;
