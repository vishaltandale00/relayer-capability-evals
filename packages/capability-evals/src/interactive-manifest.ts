import type { CapabilitySuiteManifestV1 } from "@relayer/eval-runner";

// Pinned membership: content edits require an intentional new manifest revision.
export const interactiveHumanExplorationManifest: CapabilitySuiteManifestV1 = {
  "schemaVersion": 1,
  "id": "interactive-human-exploration-v1",
  "name": "Interactive human exploration · ten tasks",
  "status": "candidate",
  "presentationContract": {
    "rubricVersion": "graph-presentation-rubric-v11",
    "rubricDigest": "sha256:675ee8745eec9af4d8e6d9fbeda552c2fd326275e3a3e8e5a9595d9e3e615b53",
    "recursiveContractId": "recursive-presentation-judge-v6",
    "recursiveContractVersion": 6,
    "recursiveContractDigest": "sha256:e9f607683df96fd5d7e5f17feffbca4754b30b75351c71836ffa859a7a1c3264",
    "judgeContractId": "simulated-user-tools-v1",
    "judgeContractDigest": "sha256:75832b4b373c657e2c6f87a37577fd4ba2ec49a583b8c4282d00b2abb3c8e34f",
    "promptVersion": "simulated-user-judge-prompt-v11"
  },
  "members": [
    {
      "caseId": "capability.greenfield.tournament-operations",
      "expectedCaseSnapshotDigest": "sha256:3c268c6b5d032069bbf9d6847671a14b80f27b59f0a7d81079d14aea972a2e44",
      "outcomeContractVersion": "tournament-operations-outcome-v1",
      "outcomeContractDigest": "sha256:7534b1fb217d9e9fe97c3083b41baccb58c92c0e408ee2de66ee35ddc1083e7f",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "autonomous.node-redis.command-queue-race",
      "expectedCaseSnapshotDigest": "sha256:9ebe98fc49431610a8fea0da6aa31613df8a080fb0448e7ce44a2fcfce5d8f7f",
      "outcomeContractVersion": "node-redis-command-queue-race-outcome-v1",
      "outcomeContractDigest": "sha256:e74aee1f32ef6ebbff0517b11913cecd3a5077acbaab72064cba7838a605136b",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.europe-trip",
      "expectedCaseSnapshotDigest": "sha256:54a82ef3b437e5bc1eb89d1e16eaed38a8b241a87134a2372c494c7172805a94",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.restaurant-celebration",
      "expectedCaseSnapshotDigest": "sha256:3fbcd707e5af18704935acb38cf9988c47f7e21452126c2b775b9ec41a67d80d",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.local-weekend",
      "expectedCaseSnapshotDigest": "sha256:9d5984ef572f0b32e42fb1adb3cdef4663a0754bb048d12e75d717eede13abea",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.discussion-evening",
      "expectedCaseSnapshotDigest": "sha256:552a213585760a6c72764f676c61c58cdc453833439f6a19f77498bac4a58d08",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.learning-plan",
      "expectedCaseSnapshotDigest": "sha256:477b7e634826d6bc7cd85c38a1e42f28e97f3d3edfd6f2f23c05b21293aa007f",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.workspace-refresh",
      "expectedCaseSnapshotDigest": "sha256:3082cc4f73239fcd57607c21f6f1ed13a8cfdd8629e4ef839a07e4b5287a6ae5",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.community-workshop",
      "expectedCaseSnapshotDigest": "sha256:2e05d27af12ee5ee81d7211e0236b3c52d332985ecfce7a00bb01cf92da1df64",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    },
    {
      "caseId": "interactive.everyday.household-move",
      "expectedCaseSnapshotDigest": "sha256:7a8d32357aea1d42cf015d74437ec5a4a6156b28961159152dbf2d6aa3d88b5c",
      "outcomeContractVersion": "interactive-human-review-v1",
      "outcomeContractDigest": "sha256:e3054002cfd6c2f0d9026250280916aed1c45c808e5b6ef4c7ee1be29191bc12",
      "presentationPolicyDigest": "sha256:0dcb1cb52bec5aa392f56cee38082284b994748845c049862acc0f2070aa1c08"
    }
  ],
  "suiteDigest": "sha256:1e2366b4c77687af4dbfdf5ba572c29e1482ef6b21649efcd4be1b2880daf0be"
};
