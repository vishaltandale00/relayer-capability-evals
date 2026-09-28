import { projectCapabilitySuiteCatalog, resolveCapabilitySuite, } from "@relayer/eval-runner";
import { apiContractSimulationLaboratoryCase } from "./project-cases/api-contract-simulation-laboratory.js";
import { emergencyEvacuationCase } from "./project-cases/emergency-evacuation-case.js";
import { excalidrawSceneHistoryCase } from "./project-cases/excalidraw-scene-history.js";
import { httpcoreCancellationCase } from "./project-cases/httpcore-cancellation.js";
import { jupyterLabExecutionBundlesCase } from "./project-cases/jupyterlab-execution-bundles.js";
import { nodeRedisCommandQueueRaceCase } from "./project-cases/node-redis.js";
import { productionDeliveryPlannerCase } from "./project-cases/production-delivery-planner.js";
import { reservationCapacityCase } from "./project-cases/reservation-capacity-case.js";
import { saasOperatingModelCase } from "./project-cases/saas-operating-model.js";
import { tournamentOperationsCase } from "./project-cases/tournament-operations-case.js";
export const HARNESS_CAPABILITY_PILOT_V1_ID = "harness-capability-pilot-v1";
export const orderedCases = [
    reservationCapacityCase,
    tournamentOperationsCase,
    apiContractSimulationLaboratoryCase,
    emergencyEvacuationCase,
    httpcoreCancellationCase,
    nodeRedisCommandQueueRaceCase,
    excalidrawSceneHistoryCase,
    jupyterLabExecutionBundlesCase,
    saasOperatingModelCase,
    productionDeliveryPlannerCase,
];
/**
 * Version 1 is intentionally declared once and validated against the live case
 * registry below. A later accepted change creates a new suite version.
 */
export const harnessCapabilityPilotV1Manifest = ({
    schemaVersion: 1,
    id: HARNESS_CAPABILITY_PILOT_V1_ID,
    name: "Harness capability pilot v1",
    status: "candidate",
    presentationContract: {
        rubricVersion: "graph-presentation-rubric-v11",
        rubricDigest: "sha256:675ee8745eec9af4d8e6d9fbeda552c2fd326275e3a3e8e5a9595d9e3e615b53",
        recursiveContractId: "recursive-presentation-judge-v6",
        recursiveContractVersion: 6,
        recursiveContractDigest: "sha256:e9f607683df96fd5d7e5f17feffbca4754b30b75351c71836ffa859a7a1c3264",
        judgeContractId: "simulated-user-tools-v1",
        judgeContractDigest: "sha256:75832b4b373c657e2c6f87a37577fd4ba2ec49a583b8c4282d00b2abb3c8e34f",
        promptVersion: "simulated-user-judge-prompt-v11",
    },
    members: [
        {
            caseId: "capability.greenfield.reservation-capacity",
            expectedCaseSnapshotDigest: "sha256:7d7934e955ecefa81f8dfec693f283ecede37bb387738984dbfca586150b8820",
            outcomeContractVersion: "reservation-capacity-outcome-v1",
            outcomeContractDigest: "sha256:0c51a56c2da5714de2335fabdb0a8c2d4daf156c4f1de3da433ee503344873db",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "capability.greenfield.tournament-operations",
            expectedCaseSnapshotDigest: "sha256:bdc5c594dc8f63dfc90787d1d688e77b2661b2f624fcd08056b282c6a356839c",
            outcomeContractVersion: "tournament-operations-outcome-v1",
            outcomeContractDigest: "sha256:7534b1fb217d9e9fe97c3083b41baccb58c92c0e408ee2de66ee35ddc1083e7f",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "capability.greenfield.api-contract-simulation-laboratory",
            expectedCaseSnapshotDigest: "sha256:0a24c04fb24d9a92c91ef2824051b3b697a66633d3f0c5b99557a4d4601cbe24",
            outcomeContractVersion: "api-contract-simulation-laboratory-outcome-v1",
            outcomeContractDigest: "sha256:a3c90bc24424b0762763f2f5bc164fb35d85e8d28f139bc2797d0db7ef31e477",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "capability.greenfield.emergency-evacuation-route-planner",
            expectedCaseSnapshotDigest: "sha256:ef56a9a9ca9ed3a88a495c86dc87e1356c17ab93dc6d246d4a0b634ea319bef8",
            outcomeContractVersion: "emergency-evacuation-outcome-v1",
            outcomeContractDigest: "sha256:fe4be6e128aeb55b674a97c0c913d6a72fe516eafb5bcfc959da66611952cf3f",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "autonomous.httpcore.cancellation-poisoned-pool",
            expectedCaseSnapshotDigest: "sha256:8aa6ec69462beadcaa9d3d1ac73a24fee51141b0d734f2adc9ddcdc2f31bb160",
            outcomeContractVersion: "httpcore-cancellation-outcome-v1",
            outcomeContractDigest: "sha256:031aa292df90b8b921d925152315fae4ce322b9647cbed57cc2304cb5f9adfa5",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "autonomous.node-redis.command-queue-race",
            expectedCaseSnapshotDigest: "sha256:9ebe98fc49431610a8fea0da6aa31613df8a080fb0448e7ce44a2fcfce5d8f7f",
            outcomeContractVersion: "node-redis-command-queue-race-outcome-v1",
            outcomeContractDigest: "sha256:e74aee1f32ef6ebbff0517b11913cecd3a5077acbaab72064cba7838a605136b",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "autonomous.excalidraw.scene-history",
            expectedCaseSnapshotDigest: "sha256:c7b9a2aec0a8c7f202ce3e2081708b3bb259cf5e343a1cfc7e457ed81804bd07",
            outcomeContractVersion: "excalidraw-scene-history-outcome-v1",
            outcomeContractDigest: "sha256:5bc466b2dd2a068b159580de492fcced1118501775114d78f1a1942dd00fa65d",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "jupyterlab.reproducible-execution-bundles",
            expectedCaseSnapshotDigest: "sha256:0dd735befb41ded21b0f81d556540961c0e79825de6c91c4a8f231a7a52b31ec",
            outcomeContractVersion: "jupyterlab-execution-bundles-outcome-v1",
            outcomeContractDigest: "sha256:7d468da55a37c042ac3a402473db381973f13ebefc9f7b91e3c005a72974b4a5",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "capability.spreadsheet.saas-operating-model",
            expectedCaseSnapshotDigest: "sha256:8c56d0811f81813ba3a39273ab6e3d10c4e89f99e6e7c73b120a842c98b6c4ee",
            outcomeContractVersion: "saas-operating-model-outcome-v1",
            outcomeContractDigest: "sha256:7ea1b29870c555b38c2764405657b9084fca1442d4a3c55ab500aa9f5de2f112",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
        {
            caseId: "capability.spreadsheet.production-delivery-planner",
            expectedCaseSnapshotDigest: "sha256:56b146a264639a80dae8130c9f0ba1bd64359430ce504ab2d3b9c6b2a8512377",
            outcomeContractVersion: "production-delivery-planner-outcome-v1",
            outcomeContractDigest: "sha256:eae35f2d9e89d2b11a5c533a73b274c886364002cfd006460d0204a9f59e0919",
            presentationPolicyDigest: "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08",
        },
    ],
    suiteDigest: "sha256:4547a364d9bf79f165916ac772b8a4c9358693b5c8b88b8416ee5aaa2efe0065",
});
export function resolveHarnessCapabilityPilotV1() {
    return resolveCapabilitySuite(harnessCapabilityPilotV1Manifest, orderedCases);
}
export function getCapabilitySuiteCatalog() {
    return [projectCapabilitySuiteCatalog(harnessCapabilityPilotV1Manifest, orderedCases)];
}
