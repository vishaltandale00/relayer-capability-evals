import { type EvalCaseRegistrationV1 } from "@relayer/eval-runner";
export declare const interactiveEverydayCases: {
    boundCase: import("@relayer/eval-runner").BoundAutonomousCase<{
        id: string;
        name: string;
        description: string;
        threads: {
            id: string;
            name: string;
            permissionProfileId: "auto";
            mutationPolicy: "writable";
            prompts: string[];
            workspaceGrade: "implementation";
        }[];
    }>;
    files: Record<string, string>;
}[];
export declare const interactiveEverydayRegistrations: readonly EvalCaseRegistrationV1[];
export { interactiveHumanExplorationManifest } from "./interactive-manifest.js";
