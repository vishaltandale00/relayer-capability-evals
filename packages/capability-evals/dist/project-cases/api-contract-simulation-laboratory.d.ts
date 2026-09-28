import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";
export declare const API_CONTRACT_SIMULATION_LABORATORY_CASE_ID = "capability.greenfield.api-contract-simulation-laboratory";
export declare const API_CONTRACT_SIMULATION_LABORATORY_VERIFIER_SOURCE_SHA256 = "e806fe48875bfeaeb89f083b09f48496b380ec0be6e464edb01dee4763e31c3a";
export declare const API_CONTRACT_SIMULATION_LABORATORY_GATE_CHECK_PATTERNS: Readonly<{
    "contract-import": readonly string[];
    "mock-routing": readonly string[];
    "request-response-validation": readonly string[];
    "fault-injection": readonly string[];
    "bounded-http": readonly string[];
    "revision-compatibility": readonly string[];
    "deterministic-replay": readonly string[];
    "scoped-api-laboratory-delivery": readonly string[];
}>;
export declare const apiContractSimulationLaboratoryCase: import("@relayer/eval-runner").BoundAutonomousCase<Readonly<{
    schemaVersion: 1;
    id: "capability.greenfield.api-contract-simulation-laboratory";
    name: "API contract simulation laboratory";
    description: "Builds a deterministic, contract-driven mock service and compatibility laboratory behind a public HTTP seam.";
    localOnly: true;
    supportedPlatform: "darwin";
    autonomous: true;
    category: "coding";
    taskType: "greenfield-build";
    fixture: Readonly<{
        source: "relayer-eval://capability/capability.greenfield.api-contract-simulation-laboratory";
        revision: `template:sha256:${string}`;
        packageManager: "node@22-builtins-only";
    }>;
    threads: readonly ProjectEvalThreadDefinition[];
}>>;
export declare const apiContractSimulationLaboratoryCaseIds: Set<string>;
export interface ApiContractSimulationLaboratoryFixtureReceipt {
    readonly schemaVersion: 1;
    readonly fixtureId: typeof API_CONTRACT_SIMULATION_LABORATORY_CASE_ID;
    readonly workspaceDirectory: string;
    readonly repositoryUrl: string;
    readonly sourceRevision: string;
    readonly seededCommit: string;
    readonly seededTree: string;
    readonly packageManager: "node@22-builtins-only";
    readonly installedWithFrozenLockfile: false;
    readonly environmentDigest: `sha256:${string}`;
}
export declare function materializeApiContractSimulationLaboratoryFixture(options: {
    readonly workspaceDirectory: string;
    readonly platform?: NodeJS.Platform;
    readonly runCommand?: CommandRunner;
}): Promise<ApiContractSimulationLaboratoryFixtureReceipt>;
interface RunningLaboratory {
    readonly baseUrl: string;
    readonly stop: () => Promise<void>;
}
export type LaboratoryLauncher = (workspaceDirectory: string) => Promise<RunningLaboratory>;
export declare function gradeApiContractSimulationLaboratoryWorkspace(options: {
    readonly workspaceDirectory: string;
    readonly baseRevision?: string;
    readonly runCommand?: CommandRunner;
    readonly launch?: LaboratoryLauncher;
}): Promise<readonly EvalCheck[]>;
export declare function verifyApiContractSimulationLaboratoryPublicSeam(baseUrl: string): Promise<readonly EvalCheck[]>;
export declare function preflightApiContractSimulationLaboratoryEnvironment(): Promise<{
    readonly available: true;
    readonly environmentDigest: `sha256:${string}`;
} | {
    readonly available: false;
    readonly reason: string;
}>;
export {};
