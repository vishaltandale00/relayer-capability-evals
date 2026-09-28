import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
export declare const EMERGENCY_EVACUATION_CASE_ID = "capability.greenfield.emergency-evacuation-route-planner";
export declare const EMERGENCY_EVACUATION_NODE_RUNTIME: Readonly<{
    version: "22.23.2";
    platform: "darwin";
    architecture: "arm64";
    executableDigest: "sha256:18e387c90ab8a8400183e8bdd396376e1e875b91b4c874b894dcade7b35bf572";
}>;
export declare const EMERGENCY_EVACUATION_VERIFIER_SOURCE_SHA256 = "60705a8a28d8c7ec2a3abf9e894819628b7de1710647bba3fca083be8670b377";
export interface EmergencyEvacuationCaseDefinition {
    readonly schemaVersion: 1;
    readonly id: typeof EMERGENCY_EVACUATION_CASE_ID;
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
export declare const emergencyEvacuationMandatoryGateChecks: Readonly<{
    "runtime-authority": readonly string[];
    "public-interface": readonly string[];
    "route-legality": readonly string[];
    "capacity-accessibility": readonly string[];
    "timing-dependencies": readonly string[];
    "priority-alternatives": readonly string[];
    "conservation-delivery": readonly string[];
}>;
export declare function evaluateEmergencyEvacuationMandatoryGate(gateId: string, checks: readonly EvalCheck[]): {
    readonly complete: boolean;
    readonly passed: boolean;
    readonly matched: readonly EvalCheck[];
} | null;
export declare const emergencyEvacuationCase: import("@relayer/eval-runner").BoundAutonomousCase<EmergencyEvacuationCaseDefinition>;
export declare const emergencyEvacuationCaseIds: Set<string>;
export interface EmergencyEvacuationFixtureReceipt {
    readonly schemaVersion: 1;
    readonly fixtureId: typeof EMERGENCY_EVACUATION_CASE_ID;
    readonly workspaceDirectory: string;
    readonly repositoryUrl: string;
    readonly sourceRevision: string;
    readonly seededCommit: string;
    readonly seededTree: string;
    readonly contentDigest: string;
    readonly environmentDigest: string;
    readonly packageManager: "node@22";
    readonly installedWithFrozenLockfile: false;
}
export interface AuthenticatedEmergencyNodeRuntime {
    readonly path: string;
    readonly version: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.version;
    readonly platform: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.platform;
    readonly architecture: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.architecture;
    readonly executableDigest: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.executableDigest;
}
export interface EmergencyEvacuationNodeRuntimeReceipt {
    readonly version: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.version;
    readonly platform: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.platform;
    readonly architecture: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.architecture;
    readonly executableDigest: typeof EMERGENCY_EVACUATION_NODE_RUNTIME.executableDigest;
    readonly environmentDigest: string;
}
export declare function materializeEmergencyEvacuationFixture(options: {
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly runCommand?: CommandRunner;
}): Promise<EmergencyEvacuationFixtureReceipt>;
export declare function gradeEmergencyEvacuationWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly baseRevision?: string;
    readonly nodeExecutable?: string;
    readonly runCommand?: CommandRunner;
}): Promise<readonly EvalCheck[]>;
export declare function preflightEmergencyEvacuationEnvironment(options: {
    readonly nodeExecutable: string;
    readonly cwd: string;
    readonly runCommand?: CommandRunner;
}): Promise<{
    readonly available: true;
    readonly nodeExecutable: string;
    readonly runtime: EmergencyEvacuationNodeRuntimeReceipt;
} | {
    readonly available: false;
    readonly reason: string;
}>;
