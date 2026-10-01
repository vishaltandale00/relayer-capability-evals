import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bindAutonomousCaseSnapshot, canonicalJson, createAutonomousCaseSnapshot, type CaseContentDigest, type EvalCaseRegistrationV1 } from "@relayer/eval-runner";

import { gradeInteractiveArtifact } from "../verifiers/interactive-artifact.mjs";

const run = promisify(execFile);
const verifierBytes = await readFile(new URL("../verifiers/interactive-artifact.mjs", import.meta.url));
const verifierDigest: CaseContentDigest = `sha256:${createHash("sha256").update(verifierBytes).digest("hex")}`;
const digest = (value: unknown): CaseContentDigest => `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
const restaurantSource = await readFile(new URL("../fixtures/restaurant-server.mjs", import.meta.url), "utf8");
const reviewCriteria = [
  "Clarification: elicit consequential unknown personal facts naturally, without a prescribed question sequence or mandatory correction.",
  "Graph usability: support decisions throughout, expose options and tradeoffs, move the current pointer with the work, and make real graph-native interactions useful. An input-labelled node alone is insufficient.",
  "Answer incorporation: propagate the participant's material answers into relevant choices and the final artifact without inventing preferences.",
  "Outcome fit: deliver a concrete usable artifact aligned with the participant's stated preferences; distinguish unresolved decisions from completion.",
  "Research: use current sources and tools substantively; record sources and retrieval dates, distinguish confirmed facts, estimates and unknown availability.",
];
// Content is intentionally exploratory. These profiles do not prescribe an action sequence.
const profileBytes = await readFile(new URL("../profiles/everyday-v1.json", import.meta.url));
const profileDigest: CaseContentDigest = `sha256:${createHash("sha256").update(profileBytes).digest("hex")}`;
const content: readonly { id: string; name: string; prompt: string; brief: string; endpoint: string }[] = JSON.parse(profileBytes.toString("utf8"));

export const interactiveEverydayCases = content.map((item) => {
  const id = `interactive.everyday.${item.id}`;
  const files: Record<string, string> = { "README.md": `# ${item.name}\n\n${item.prompt}\n\nSave the agreed output in deliverable.md. Include current research sources with retrieval dates, assumptions and unresolved decisions. Do not make real purchases, bookings or commitments.\n` };
  if (item.id === "restaurant-celebration") {
    files["restaurant-server.mjs"] = restaurantSource;
    files["README.md"] += "\nThe restaurant website is fictional. Start it with `node restaurant-server.mjs` and use the printed loopback URL in a browser. It supports search, reservation, modification, cancellation and confirmation records. State is saved in restaurant-state.json. Do not replace the website or fabricate its records. Research outside the fixture must be clearly distinguished from fictional availability.\n";
  }
  const source = `relayer-interactive-fixture:${id}`;
  const revision = digest(files);
  const definition = { id, name: item.name, description: "Exploratory interactive human task; no comparative baseline or automatic taste-fit certification.",
    threads: [{ id: "task", name: item.name, permissionProfileId: "auto" as const, mutationPolicy: "writable" as const, prompts: [item.prompt], workspaceGrade: "implementation" as const }] };
  const rubric = { kind: "outcome-rubric" as const, rubricVersion: "interactive-human-review-v1", criteria: [{ id: "artifact", label: "Output artifact", description: "An output artifact exists; human review determines quality and personal fit.", weight: 1 }] };
  const boundCase = bindAutonomousCaseSnapshot(definition, createAutonomousCaseSnapshot({ ...definition, category: "work", taskType: "interactive-planning", authoringStatus: "candidate",
    interactive: { schemaVersion: 1, participantBrief: item.brief, reviewerRubric: { version: rubric.rubricVersion, criteria: reviewCriteria }, endpoint: item.endpoint, maxCompletions: 8, research: "current-sources-and-dates" },
    artifacts: {
      task: { kind: "visible-task", text: item.prompt, contentDigest: digest(item.prompt) },
      workspace: { kind: "frozen-workspace", materializerId: "interactive-git-files-v2", source, revision, contentDigest: revision, environmentDigest: digest({ runtime: "node>=22.8", browser: "required", network: "current-research", workspace: "isolated-git-root-v1" }) },
      reference: { kind: "sealed-reference", artifactId: `${id}.participant`, format: "participant-profile", contentDigest: profileDigest, sealedPath: "packages/capability-evals/profiles/everyday-v1.json" },
      verifier: { kind: "sealed-verifier", artifactId: `${id}.evidence`, verifierId: "interactive-artifact-presence-v1", contentDigest: verifierDigest, sealedPath: "packages/capability-evals/verifiers/interactive-artifact.mjs", mandatoryGates: [{ id: "interactive-artifact", label: "Output artifact", description: "An output artifact exists; quality and intent fit require human review." }] },
      outcomeRubric: { ...rubric, contentDigest: digest(rubric) },
    },
  }));
  return { boundCase, files };
});

export const interactiveEverydayRegistrations: readonly EvalCaseRegistrationV1[] = interactiveEverydayCases.map(({ boundCase, files }) => ({
  boundCase, definition: { ...boundCase.definition, caseSnapshot: boundCase.catalogSnapshot, caseSnapshotDigest: boundCase.snapshotDigest }, available: true, unavailableReason: null,
  materialize: async ({ workspaceDirectory }) => {
    await mkdir(workspaceDirectory, { recursive: true });
    for (const [path, text] of Object.entries(files)) await writeFile(join(workspaceDirectory, path), text, { flag: "wx" });
    const options = { cwd: workspaceDirectory, env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))), GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z" } };
    await run("git", ["init", "--quiet", "--initial-branch=main", "--template="], options);
    await run("git", ["add", "--", ...Object.keys(files)], options);
    await run("git", ["-c", "user.name=Relayer Eval", "-c", "user.email=eval@relayer.invalid", "-c", "commit.gpgsign=false", "-c", `core.hooksPath=${join(workspaceDirectory, ".git", "disabled-hooks")}`, "commit", "--quiet", "-m", "Seed isolated interactive task"], options);
    const seededCommit = (await run("git", ["rev-parse", "HEAD"], options)).stdout.trim();
    return { workspaceDirectory, repositoryUrl: boundCase.snapshot.artifacts.workspace.source, sourceRevision: boundCase.snapshot.artifacts.workspace.revision, seededCommit };
  },
  grade: gradeInteractiveArtifact,
  evaluateMandatoryGate: (gate, checks) => { const matched = checks.filter(c => c.name === gate.id); return { complete: matched.length === 1, passed: matched.length === 1 && matched[0]!.passed, matched }; },
}));

export { interactiveHumanExplorationManifest } from "./interactive-manifest.js";
