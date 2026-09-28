import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative } from "node:path";
import { promisify } from "node:util";

import { bindAutonomousCaseSnapshot } from "@relayer/eval-runner";
import { createAutonomousCaseSnapshot } from "@relayer/eval-runner";
import type { EvalCheck } from "@relayer/eval-runner";
import type { CommandResult, CommandRunner, ProjectEvalThreadDefinition } from "@relayer/eval-runner";

export const EMERGENCY_EVACUATION_CASE_ID = "capability.greenfield.emergency-evacuation-route-planner";
export const EMERGENCY_EVACUATION_NODE_RUNTIME = Object.freeze({
  version: "22.23.2",
  platform: "darwin",
  architecture: "arm64",
  executableDigest: "sha256:18e387c90ab8a8400183e8bdd396376e1e875b91b4c874b894dcade7b35bf572",
});
export const EMERGENCY_EVACUATION_VERIFIER_SOURCE_SHA256 = "60705a8a28d8c7ec2a3abf9e894819628b7de1710647bba3fca083be8670b377";

type Priority = "critical" | "high" | "standard";
interface Street { readonly id: string; readonly a: string; readonly b: string; readonly minutes: number }
interface Vehicle { readonly id: string; readonly startNodeId: string; readonly capacity: number; readonly wheelchairCapacity: number; readonly availableAt: number }
interface Pickup { readonly id: string; readonly nodeId: string; readonly people: number; readonly wheelchairUsers: number; readonly priority: Priority; readonly readyAt: number; readonly deadline: number; readonly dependsOn: readonly string[] }
interface Shelter { readonly id: string; readonly nodeId: string; readonly capacity: number; readonly wheelchairCapacity: number }
interface Scenario {
  readonly id: string;
  readonly boardingMinutes: number;
  readonly nodes: readonly string[];
  readonly streets: readonly Street[];
  readonly closedStreetIds: readonly string[];
  readonly vehicles: readonly Vehicle[];
  readonly pickups: readonly Pickup[];
  readonly shelters: readonly Shelter[];
  readonly requiredAlternatives: number;
}
interface Assignment {
  readonly pickupId?: unknown;
  readonly vehicleId?: unknown;
  readonly shelterId?: unknown;
  readonly startAt?: unknown;
  readonly pickupAt?: unknown;
  readonly arriveAt?: unknown;
  readonly toPickupStreetIds?: unknown;
  readonly toShelterStreetIds?: unknown;
}
interface CandidateOutput { readonly scenarioId?: unknown; readonly plans?: unknown }

const visibleTask = `Build and commit a working emergency evacuation route planner in this repository. Keep the declared black-box CLI stable; internal architecture and algorithms are your choice. Use only Node 22 built-ins and do not add third-party dependencies. Qualification runs without network or child-process authority, reads only the committed workspace, evaluator input, and trusted system runtime, and permits workspace-local writes. Run relevant checks, leave the Git workspace clean, and do not push or publish anything.

The operator-facing production seam is \`node src/cli.js <absolute-or-relative-scenario.json>\`. It must read the documented JSON scenario and write only one JSON result to stdout, exiting nonzero without modifying the input when the JSON is malformed or the scenario is invalid. Invalid scenarios include duplicate street IDs, a closure naming an unknown street, negative vehicle capacities, pickup dependencies naming unknown pickups, and non-positive \`requiredAlternatives\`. The result is \`{ "scenarioId": string, "plans": Plan[] }\`. Each Plan has a stable, nonempty, unique \`id\`, \`assignments\`, and the exact complement \`unassignedPickupIds\`. Each assignment has \`pickupId\`, \`vehicleId\`, \`shelterId\`, integer \`startAt\`, \`pickupAt\`, \`arriveAt\`, and ordered \`toPickupStreetIds\` / \`toShelterStreetIds\`.

Streets are static, undirected, and weighted in integer minutes. Closed streets may not be used. A vehicle starts at its declared node and may perform at most one pickup trip. It may wait before starting. Its first route must end at the pickup node and its second at the chosen shelter. Pickup time is route arrival; shelter arrival adds boarding time and the shelter route. Pickup cannot precede vehicle availability or group ready time. A deadline is inclusive and applies to shelter arrival. Every dependency must also be assigned, and its shelter arrival must be no later than the dependent group's pickup time.

People and wheelchair users are indivisible groups. A vehicle and shelter must each have enough total and wheelchair capacity. A pickup appears at most once, vehicles are unique within a plan, unassigned IDs are exact, and no people may be invented, duplicated, or lost. Under scarcity, maximize served groups lexicographically by critical, then high, then standard priority; never displace a feasible higher-priority group for a lower-priority one. Return at least \`requiredAlternatives\` independently valid priority-optimal plans. Alternatives must differ in a vehicle/shelter assignment or in an ordered street route, not only IDs or array ordering. Identical input must produce deterministic JSON. The planner must handle reordered inputs and evaluator-owned changes to closures, capacities, accessibility needs, dependencies, and exact deadline boundaries.`;

const baseScenario = Object.freeze({
  id: "harbor-fire-001",
  boardingMinutes: 2,
  nodes: ["depot-north", "depot-south", "clinic", "school", "apartments", "junction-east", "junction-west", "shelter-hill", "shelter-river"],
  streets: [
    { id: "north-clinic", a: "depot-north", b: "clinic", minutes: 3 },
    { id: "north-west", a: "depot-north", b: "junction-west", minutes: 2 },
    { id: "west-clinic", a: "junction-west", b: "clinic", minutes: 2 },
    { id: "clinic-east", a: "clinic", b: "junction-east", minutes: 2 },
    { id: "west-east", a: "junction-west", b: "junction-east", minutes: 4 },
    { id: "south-school", a: "depot-south", b: "school", minutes: 2 },
    { id: "south-apartments", a: "depot-south", b: "apartments", minutes: 3 },
    { id: "school-east", a: "school", b: "junction-east", minutes: 2 },
    { id: "apartments-east", a: "apartments", b: "junction-east", minutes: 2 },
    { id: "east-hill", a: "junction-east", b: "shelter-hill", minutes: 3 },
    { id: "east-river", a: "junction-east", b: "shelter-river", minutes: 4 },
    { id: "west-river", a: "junction-west", b: "shelter-river", minutes: 6 },
    { id: "clinic-hill", a: "clinic", b: "shelter-hill", minutes: 6 },
    { id: "school-river", a: "school", b: "shelter-river", minutes: 5 },
  ],
  closedStreetIds: ["west-east"],
  vehicles: [
    { id: "van-north", startNodeId: "depot-north", capacity: 6, wheelchairCapacity: 1, availableAt: 0 },
    { id: "bus-south", startNodeId: "depot-south", capacity: 10, wheelchairCapacity: 0, availableAt: 0 },
    { id: "accessible-south", startNodeId: "depot-south", capacity: 4, wheelchairCapacity: 2, availableAt: 0 },
  ],
  pickups: [
    { id: "clinic-patients", nodeId: "clinic", people: 3, wheelchairUsers: 1, priority: "critical", readyAt: 0, deadline: 13, dependsOn: [] },
    { id: "apartment-residents", nodeId: "apartments", people: 4, wheelchairUsers: 1, priority: "high", readyAt: 0, deadline: 18, dependsOn: ["clinic-patients"] },
    { id: "school-group", nodeId: "school", people: 8, wheelchairUsers: 0, priority: "standard", readyAt: 0, deadline: 15, dependsOn: [] },
  ],
  shelters: [
    { id: "hill", nodeId: "shelter-hill", capacity: 7, wheelchairCapacity: 2 },
    { id: "river", nodeId: "shelter-river", capacity: 12, wheelchairCapacity: 1 },
  ],
  requiredAlternatives: 2,
} satisfies Scenario);

const readme = `# Harbor Emergency Evacuation Planner

${visibleTask}

The frozen example is \`fixtures/harbor-fire.json\`. Build a real planner behind the CLI whose result exposes alternatives, unassigned groups, and route/timing/capacity decisions. The evaluator invokes only the documented CLI with separate scenarios and independently replays every route and resource transition. Candidate tests and package scripts are not verifier authority.
`;

const starterFiles = Object.freeze({
  "README.md": readme,
  "package.json": `${JSON.stringify({ name: "harbor-emergency-route-planner", private: true, type: "module", scripts: { test: "node --test" } }, null, 2)}\n`,
  "fixtures/harbor-fire.json": `${JSON.stringify(baseScenario, null, 2)}\n`,
  "src/cli.js": `process.stderr.write("Emergency route planner is not implemented.\\n");\nprocess.exitCode = 1;\n`,
  "test/contract.test.js": `import test from "node:test";\nimport assert from "node:assert/strict";\ntest("the frozen scenario documents alternatives", async () => { const scenario = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../fixtures/harbor-fire.json", import.meta.url))); assert.equal(scenario.requiredAlternatives, 2); });\n`,
});

const digest = (value: string): `sha256:${string}` => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const canonicalFiles = (files: Readonly<Record<string, string>>): string => Object.entries(files).sort(([a], [b]) => a.localeCompare(b)).map(([path, contents]) => `${path}\0${contents.length}\0${contents}`).join("\0");
const fixtureDigest = digest(canonicalFiles(starterFiles));
const fixtureRevision = `template:${fixtureDigest}`;
const environmentDigest = digest(JSON.stringify({ nodeRuntime: EMERGENCY_EVACUATION_NODE_RUNTIME, externalServices: false, thirdPartyDependencies: false, seatbelt: "workspace-input-read-workspace-write-no-network-no-fork" }));
const expectedSeededTree = "d8e3c7d29fe53d0e9bb12553f57e53301d551f38";

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
  readonly fixture: { readonly source: string; readonly revision: string; readonly packageManager: "node@22" };
  readonly threads: readonly ProjectEvalThreadDefinition[];
}

const definition: EmergencyEvacuationCaseDefinition = Object.freeze({
  schemaVersion: 1,
  id: EMERGENCY_EVACUATION_CASE_ID,
  name: "Emergency evacuation route planner",
  description: "Builds a substantial planner over a frozen street network with closures, accessibility, precedence, deadlines, priorities, alternatives, and conservation.",
  localOnly: true,
  supportedPlatform: "darwin",
  autonomous: true,
  category: "coding",
  taskType: "greenfield-build",
  fixture: Object.freeze({ source: `relayer-eval://capability/${EMERGENCY_EVACUATION_CASE_ID}`, revision: fixtureRevision, packageManager: "node@22" }),
  threads: Object.freeze([Object.freeze({
    id: "delivery",
    name: "Build and verify the planner",
    permissionProfileId: "auto",
    mutationPolicy: "writable",
    workspaceGrade: "autonomous-implementation",
    prompts: Object.freeze([visibleTask]),
  })]),
});

const mandatoryGates = Object.freeze([
  { id: "runtime-authority", label: "Pinned runtime authority", description: "Qualification authenticates the pinned standalone Node executable before candidate code runs." },
  { id: "public-interface", label: "Public planner interface", description: "The declared operator-facing CLI returns deterministic, parseable plans and rejects invalid scenarios without changing their input." },
  { id: "route-legality", label: "Route legality and closures", description: "Every route is contiguous in the frozen undirected network, starts and ends correctly, and avoids closures." },
  { id: "capacity-accessibility", label: "Capacity and accessibility", description: "Vehicle and shelter people and wheelchair capacities are independently conserved." },
  { id: "timing-dependencies", label: "Timing, deadlines, and dependencies", description: "Recomputed travel, boarding, readiness, inclusive deadlines, and pickup dependencies hold." },
  { id: "priority-alternatives", label: "Priority and feasible alternatives", description: "Scarcity preserves lexicographic priority and every required alternative is independently legal and materially distinct." },
  { id: "conservation-delivery", label: "Conservation and committed delivery", description: "Every pickup is assigned or explicitly unassigned exactly once, without phantom people, and the substantial implementation is committed cleanly." },
]);
export const emergencyEvacuationMandatoryGateChecks = Object.freeze({
  "runtime-authority": Object.freeze(["runtime:node-executable"]),
  "public-interface": Object.freeze(["public-interface:invocation", "public-interface:determinism", "public-interface:invalid-input"]),
  "route-legality": Object.freeze(["route-legality"]),
  "capacity-accessibility": Object.freeze(["capacity-accessibility"]),
  "timing-dependencies": Object.freeze(["timing-dependencies"]),
  "priority-alternatives": Object.freeze(["priority-alternatives:priority", "priority-alternatives:alternatives"]),
  "conservation-delivery": Object.freeze(["conservation-delivery:conservation", "conservation-delivery:built-ins-only", "conservation-delivery:commit", "conservation-delivery:clean"]),
});

export function evaluateEmergencyEvacuationMandatoryGate(gateId: string, checks: readonly EvalCheck[]): { readonly complete: boolean; readonly passed: boolean; readonly matched: readonly EvalCheck[] } | null {
  const requiredNames = emergencyEvacuationMandatoryGateChecks[gateId as keyof typeof emergencyEvacuationMandatoryGateChecks];
  if (!requiredNames) return null;
  const matched = requiredNames.map((suffix) => checks.find(({ name }) => name === `workspace:${suffix}` || name.endsWith(`:workspace:${suffix}`))).filter((check): check is EvalCheck => check !== undefined);
  return Object.freeze({ complete: matched.length === requiredNames.length, passed: matched.length === requiredNames.length && matched.every(({ passed }) => passed), matched: Object.freeze(matched) });
}

const verifierIdentity = [
  EMERGENCY_EVACUATION_VERIFIER_SOURCE_SHA256,
  visibleTask,
  canonicalFiles(starterFiles),
  JSON.stringify(scenarioMatrix()),
  JSON.stringify(EMERGENCY_EVACUATION_NODE_RUNTIME),
  JSON.stringify(mandatoryGates),
  JSON.stringify(emergencyEvacuationMandatoryGateChecks),
  environmentDigest,
].join("\n");
const referenceSummary = "A qualifying implementation may use any architecture or planning algorithm, but must produce deterministic priority-optimal alternatives whose routes, timing, accessibility, capacities, dependencies, and people conservation survive independent replay.";
const rubric = Object.freeze([
  { id: "planning-correctness", label: "Planning correctness", description: "The planner produces legal, feasible, priority-correct evacuation alternatives across the frozen and evaluator-owned scenarios.", weight: 4 },
  { id: "operational-usability", label: "Operational usability", description: "The CLI result makes routes, timing, capacity, accessibility, dependencies, alternatives, and unassigned groups available to emergency operators and downstream tools.", weight: 2 },
  { id: "engineering-quality", label: "Engineering quality", description: "The implementation is coherent, deterministic, tested, and maintainable without coupling to one fixture answer.", weight: 1 },
]);

export const emergencyEvacuationCase = bindAutonomousCaseSnapshot(definition, createAutonomousCaseSnapshot({
  id: definition.id,
  name: definition.name,
  description: definition.description,
  category: "coding",
  taskType: "greenfield-build",
  artifacts: {
    task: { kind: "visible-task", text: visibleTask, contentDigest: digest(visibleTask) },
    workspace: { kind: "frozen-workspace", materializerId: "emergency-evacuation-template-v1", source: definition.fixture.source, revision: definition.fixture.revision, contentDigest: fixtureDigest, environmentDigest },
    reference: { kind: "sealed-reference", artifactId: "emergency-evacuation-reference-contract-v1", format: "behavioral-contract", contentDigest: digest(referenceSummary), sealedPath: "packages/capability-evals/src/project-cases/emergency-evacuation-case.ts" },
    verifier: { kind: "sealed-verifier", artifactId: "emergency-evacuation-public-seam-verifier-v1", verifierId: "emergency-evacuation-public-seam-v1", contentDigest: digest(verifierIdentity), sealedPath: "packages/capability-evals/src/project-cases/emergency-evacuation-case.ts", mandatoryGates },
    outcomeRubric: { kind: "outcome-rubric", rubricVersion: "emergency-evacuation-outcome-v1", criteria: rubric, contentDigest: digest(JSON.stringify(rubric)) },
  },
}));

export const emergencyEvacuationCaseIds = new Set([EMERGENCY_EVACUATION_CASE_ID]);

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

export async function materializeEmergencyEvacuationFixture(options: { readonly workspaceDirectory: string; readonly platform?: NodeJS.Platform; readonly runCommand?: CommandRunner }): Promise<EmergencyEvacuationFixtureReceipt> {
  if ((options.platform ?? process.platform) !== "darwin") throw new Error("The emergency evacuation case is local Mac only.");
  if (Number.parseInt(process.versions.node.split(".")[0] ?? "", 10) !== 22) throw new Error(`The emergency evacuation case requires Node 22, received ${process.versions.node}.`);
  await requireMissing(options.workspaceDirectory);
  await writeFixtureFiles(options.workspaceDirectory);
  const runCommand = options.runCommand ?? run;
  await required(runCommand, "git", ["init", "--quiet", "--initial-branch=main"], options.workspaceDirectory);
  await required(runCommand, "git", ["config", "user.name", "Relayer Eval Fixture"], options.workspaceDirectory);
  await required(runCommand, "git", ["config", "user.email", "eval-fixture@relayer.local"], options.workspaceDirectory);
  await required(runCommand, "git", ["add", "--all"], options.workspaceDirectory);
  await required(runCommand, "git", ["commit", "--quiet", "-m", `Seed ${EMERGENCY_EVACUATION_CASE_ID}`], options.workspaceDirectory, { GIT_AUTHOR_DATE: "2026-08-28T12:00:00Z", GIT_COMMITTER_DATE: "2026-08-28T12:00:00Z" });
  const seededCommit = (await required(runCommand, "git", ["rev-parse", "HEAD"], options.workspaceDirectory)).stdout.trim();
  const seededTree = (await required(runCommand, "git", ["rev-parse", "HEAD^{tree}"], options.workspaceDirectory)).stdout.trim();
  if (seededTree !== expectedSeededTree) throw new Error(`Materialized emergency evacuation tree ${seededTree} does not match ${expectedSeededTree}.`);
  return Object.freeze({ schemaVersion: 1, fixtureId: EMERGENCY_EVACUATION_CASE_ID, workspaceDirectory: options.workspaceDirectory, repositoryUrl: definition.fixture.source, sourceRevision: definition.fixture.revision, seededCommit, seededTree, contentDigest: fixtureDigest, environmentDigest, packageManager: "node@22", installedWithFrozenLockfile: false });
}

interface ScenarioVerdict {
  readonly invocation: boolean;
  readonly deterministic: boolean;
  readonly schema: boolean;
  readonly route: boolean;
  readonly capacity: boolean;
  readonly timing: boolean;
  readonly priority: boolean;
  readonly alternatives: boolean;
  readonly conservation: boolean;
  readonly details: readonly string[];
}

export async function gradeEmergencyEvacuationWorkspace(options: { readonly workspaceDirectory: string; readonly baseRevision?: string; readonly nodeExecutable?: string; readonly runCommand?: CommandRunner }): Promise<readonly EvalCheck[]> {
  const runCommand = options.runCommand ?? run;
  const nodeRuntime = await requirePinnedNodeRuntime(options.nodeExecutable ?? process.execPath, options.workspaceDirectory, runCommand);
  const baseRevision = options.baseRevision ?? (await required(runCommand, "git", ["rev-list", "--max-parents=0", "HEAD"], options.workspaceDirectory)).stdout.trim();
  const commits = lines((await required(runCommand, "git", ["rev-list", `${baseRevision}..HEAD`], options.workspaceDirectory)).stdout);
  const status = (await required(runCommand, "git", ["status", "--porcelain=v1", "--untracked-files=all"], options.workspaceDirectory)).stdout.trim();
  const patch = await required(runCommand, "git", ["diff", "--binary", baseRevision, "HEAD"], options.workspaceDirectory);
  const verifierRoot = await mkdtemp(join(tmpdir(), "relayer-evacuation-verifier-"));
  let verdicts: readonly ScenarioVerdict[] = [];
  let invalidInputsRejected = false;
  let dependencyPolicySatisfied = false;
  try {
    const pristineWorkspace = join(verifierRoot, "workspace");
    await writeFixtureFiles(pristineWorkspace);
    const patchPath = join(verifierRoot, "candidate.patch");
    await writeFile(patchPath, patch.stdout, "utf8");
    if (patch.stdout.trim()) await required(runCommand, "git", ["apply", "--binary", "--whitespace=nowarn", patchPath], pristineWorkspace);
    await verifyContainedWorkspaceTree(pristineWorkspace);
    await requireContainedRegularFile(pristineWorkspace, "src/cli.js");
    await requireContainedRegularFile(pristineWorkspace, "package.json");
    dependencyPolicySatisfied = await verifyDependencyPolicy(pristineWorkspace);
    const scenarioVerdicts: ScenarioVerdict[] = [];
    if (!dependencyPolicySatisfied) {
      scenarioVerdicts.push(...scenarioMatrix().map(() => failedVerdict("Candidate CLI was not invoked because the committed workspace violates the built-ins-only dependency policy.")));
    } else {
      for (const scenario of scenarioMatrix()) {
        try { scenarioVerdicts.push(await verifyThroughCli(pristineWorkspace, scenario, nodeRuntime.path, runCommand)); }
        catch (error) { scenarioVerdicts.push(failedVerdict(error instanceof Error ? error.message : String(error))); }
      }
    }
    verdicts = scenarioVerdicts;
    if (dependencyPolicySatisfied) {
      try { invalidInputsRejected = await verifyMalformedCli(pristineWorkspace, nodeRuntime.path, runCommand); } catch { invalidInputsRejected = false; }
    }
  } catch (error) {
    verdicts = [{ invocation: false, deterministic: false, schema: false, route: false, capacity: false, timing: false, priority: false, alternatives: false, conservation: false, details: [error instanceof Error ? error.message : String(error)] }];
  } finally {
    await rm(verifierRoot, { recursive: true, force: true });
  }
  const detail = (key: keyof ScenarioVerdict): string => verdicts.map((verdict, index) => `scenario-${index + 1}: ${verdict[key] ? "pass" : "fail"}${verdict.details.length ? ` (${verdict.details.join("; ").slice(0, 800)})` : ""}`).join(" | ");
  const every = (key: keyof ScenarioVerdict): boolean => verdicts.length > 0 && verdicts.every((verdict) => verdict[key] === true);
  return Object.freeze([
    { name: "workspace:public-interface:invocation", passed: every("invocation") && every("schema"), detail: detail("invocation") },
    { name: "workspace:runtime:node-executable", passed: true, detail: `Authenticated ${nodeRuntime.version} ${nodeRuntime.platform}/${nodeRuntime.architecture} executable ${nodeRuntime.executableDigest}.` },
    { name: "workspace:public-interface:determinism", passed: every("deterministic"), detail: detail("deterministic") },
    { name: "workspace:public-interface:invalid-input", passed: invalidInputsRejected, detail: invalidInputsRejected ? "Malformed JSON and well-formed invalid scenarios fail closed without changing their input." : dependencyPolicySatisfied ? "At least one malformed or invalid scenario did not fail closed or changed its input." : "Candidate CLI was not invoked because the committed workspace violates the built-ins-only dependency policy." },
    { name: "workspace:route-legality", passed: every("route"), detail: detail("route") },
    { name: "workspace:capacity-accessibility", passed: every("capacity"), detail: detail("capacity") },
    { name: "workspace:timing-dependencies", passed: every("timing"), detail: detail("timing") },
    { name: "workspace:priority-alternatives:priority", passed: every("priority"), detail: detail("priority") },
    { name: "workspace:priority-alternatives:alternatives", passed: every("alternatives"), detail: detail("alternatives") },
    { name: "workspace:conservation-delivery:conservation", passed: every("conservation"), detail: detail("conservation") },
    { name: "workspace:conservation-delivery:built-ins-only", passed: dependencyPolicySatisfied, detail: dependencyPolicySatisfied ? "package.json declares no third-party dependencies." : "package.json is invalid or declares third-party dependencies." },
    { name: "workspace:conservation-delivery:commit", passed: commits.length >= 1, detail: `${commits.length} post-fixture commit(s).` },
    { name: "workspace:conservation-delivery:clean", passed: status === "", detail: status === "" ? "The candidate workspace is clean." : `Uncommitted changes remain: ${status}` },
  ]);
}

export async function preflightEmergencyEvacuationEnvironment(options: {
  readonly nodeExecutable: string;
  readonly cwd: string;
  readonly runCommand?: CommandRunner;
}): Promise<{ readonly available: true; readonly nodeExecutable: string; readonly runtime: EmergencyEvacuationNodeRuntimeReceipt } | { readonly available: false; readonly reason: string }> {
  try {
    const runtime = await requirePinnedNodeRuntime(options.nodeExecutable, options.cwd, options.runCommand ?? run);
    return {
      available: true,
      nodeExecutable: runtime.path,
      runtime: Object.freeze({
        version: runtime.version,
        platform: runtime.platform,
        architecture: runtime.architecture,
        executableDigest: runtime.executableDigest,
        environmentDigest,
      }),
    };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function scenarioMatrix(): readonly Scenario[] {
  const clone = <Value>(value: Value): Value => structuredClone(value);
  const exactDeadline: Scenario = { ...clone(baseScenario), id: "deadline-boundary", closedStreetIds: ["west-east", "school-river"], pickups: baseScenario.pickups.map((pickup) => pickup.id === "school-group" ? { ...pickup, deadline: 10 } : pickup) };
  const closureAccessibility: Scenario = { ...clone(baseScenario), id: "closure-accessibility", closedStreetIds: ["west-east", "clinic-east"], pickups: baseScenario.pickups.map((pickup) => pickup.id === "clinic-patients" ? { ...pickup, deadline: 14 } : pickup) };
  const scarcity: Scenario = {
    ...clone(baseScenario),
    id: "priority-scarcity",
    vehicles: baseScenario.vehicles.filter(({ id }) => id !== "bus-south").map((vehicle) => ({ ...vehicle, capacity: Math.max(vehicle.capacity, 8), wheelchairCapacity: Math.max(vehicle.wheelchairCapacity, 1) })),
    pickups: [...baseScenario.pickups].reverse().map((pickup) => ({
      ...pickup,
      id: pickup.priority === "critical" ? "z-critical" : pickup.priority === "high" ? "m-high" : "a-standard",
      dependsOn: [],
      deadline: 20,
      people: pickup.id === "school-group" ? 4 : pickup.people,
    })),
    shelters: baseScenario.shelters.map((shelter) => ({ ...shelter, capacity: 20, wheelchairCapacity: 4 })),
  };
  const accessibilityBoundary: Scenario = {
    ...clone(baseScenario),
    id: "accessibility-boundary",
    vehicles: [
      { id: "aaa-standard-north", startNodeId: "depot-north", capacity: 10, wheelchairCapacity: 0, availableAt: 0 },
      { id: "bbb-standard-south", startNodeId: "depot-south", capacity: 10, wheelchairCapacity: 0, availableAt: 0 },
      { id: "yyy-accessible-north", startNodeId: "depot-north", capacity: 6, wheelchairCapacity: 1, availableAt: 0 },
      { id: "zzz-accessible-south", startNodeId: "depot-south", capacity: 10, wheelchairCapacity: 2, availableAt: 0 },
    ],
    shelters: [
      { id: "aaa-inaccessible", nodeId: "shelter-river", capacity: 20, wheelchairCapacity: 0 },
      { id: "yyy-hill", nodeId: "shelter-hill", capacity: 20, wheelchairCapacity: 4 },
      { id: "zzz-river", nodeId: "shelter-river", capacity: 20, wheelchairCapacity: 4 },
    ],
  };
  const dependencyVariation: Scenario = {
    ...clone(baseScenario),
    id: "dependency-variation",
    pickups: baseScenario.pickups.map((pickup) => pickup.id === "apartment-residents"
      ? { ...pickup, dependsOn: [] }
      : pickup.id === "school-group" ? { ...pickup, dependsOn: ["clinic-patients"], deadline: 22 } : { ...pickup, deadline: 20 }),
  };
  const readinessBoundary: Scenario = {
    ...clone(baseScenario),
    id: "readiness-boundary",
    vehicles: baseScenario.vehicles.map((vehicle) => vehicle.id === "van-north" ? { ...vehicle, availableAt: 5 } : vehicle),
    pickups: baseScenario.pickups.map((pickup) => pickup.id === "clinic-patients" ? { ...pickup, readyAt: 7, deadline: 20 } : { ...pickup, deadline: 24 }),
  };
  const shelterConservation: Scenario = {
    ...clone(baseScenario),
    id: "shelter-conservation",
    shelters: [
      { id: "aaa-small", nodeId: "shelter-hill", capacity: 8, wheelchairCapacity: 2 },
      { id: "zzz-large", nodeId: "shelter-river", capacity: 20, wheelchairCapacity: 4 },
    ],
    pickups: baseScenario.pickups.map((pickup) => ({ ...pickup, deadline: 24 })),
  };
  const oneAlternative: Scenario = { ...clone(baseScenario), id: "one-alternative-boundary", requiredAlternatives: 1 };
  const threeAlternatives: Scenario = { ...clone(baseScenario), id: "three-alternatives-boundary", requiredAlternatives: 3 };
  const reordered: Scenario = { ...clone(baseScenario), id: "reordered-input", nodes: [...baseScenario.nodes].reverse(), streets: [...baseScenario.streets].reverse().map(({ a, b, ...street }) => ({ ...street, a: b, b: a })), vehicles: [...baseScenario.vehicles].reverse(), pickups: [...baseScenario.pickups].reverse(), shelters: [...baseScenario.shelters].reverse() };
  return Object.freeze([baseScenario, exactDeadline, closureAccessibility, scarcity, accessibilityBoundary, dependencyVariation, readinessBoundary, shelterConservation, oneAlternative, threeAlternatives, reordered].map((scenario) => Object.freeze(scenario)));
}

async function verifyThroughCli(workspace: string, scenario: Scenario, nodeExecutable: string, runCommand: CommandRunner): Promise<ScenarioVerdict> {
  const inputDirectory = await mkdtemp(join(tmpdir(), "relayer-evacuation-input-"));
  try {
    const inputPath = join(inputDirectory, "scenario.json");
    await writeFile(inputPath, `${JSON.stringify(scenario)}\n`, "utf8");
    const first = await runCandidateCli(workspace, inputPath, inputDirectory, nodeExecutable, runCommand);
    const second = await runCandidateCli(workspace, inputPath, inputDirectory, nodeExecutable, runCommand);
    if (first.exitCode !== 0 || second.exitCode !== 0) return failedVerdict(`CLI failed: ${(first.stderr || second.stderr || first.stdout).trim().slice(-500)}`);
    let output: CandidateOutput;
    try { output = JSON.parse(first.stdout) as CandidateOutput; } catch { return failedVerdict("CLI stdout was not one JSON value."); }
    const deterministic = first.stdout === second.stdout;
    return verifyScenarioOutput(scenario, output, deterministic);
  } finally {
    await rm(inputDirectory, { recursive: true, force: true });
  }
}

async function verifyMalformedCli(workspace: string, nodeExecutable: string, runCommand: CommandRunner): Promise<boolean> {
  const inputDirectory = await mkdtemp(join(tmpdir(), "relayer-evacuation-invalid-"));
  try {
    const clone = <Value>(value: Value): Value => structuredClone(value);
    const duplicateStreet = { ...clone(baseScenario), streets: [...baseScenario.streets, { ...baseScenario.streets[0] }] };
    const unknownClosure = { ...clone(baseScenario), closedStreetIds: [...baseScenario.closedStreetIds, "missing-street"] };
    const negativeCapacity = { ...clone(baseScenario), vehicles: baseScenario.vehicles.map((vehicle, index) => index === 0 ? { ...vehicle, capacity: -1 } : vehicle) };
    const unknownDependency = { ...clone(baseScenario), pickups: baseScenario.pickups.map((pickup, index) => index === 0 ? { ...pickup, dependsOn: ["missing-pickup"] } : pickup) };
    const noAlternatives = { ...clone(baseScenario), requiredAlternatives: 0 };
    const invalidInputs = ["{ not valid JSON\n", ...[duplicateStreet, unknownClosure, negativeCapacity, unknownDependency, noAlternatives].map((scenario) => `${JSON.stringify(scenario)}\n`)];
    const verdicts: boolean[] = [];
    for (const [index, invalid] of invalidInputs.entries()) {
      const inputPath = join(inputDirectory, `invalid-${index}.json`);
      await writeFile(inputPath, invalid, "utf8");
      const result = await runCandidateCli(workspace, inputPath, inputDirectory, nodeExecutable, runCommand);
      verdicts.push(result.exitCode !== 0 && (await readFile(inputPath, "utf8")) === invalid);
    }
    return verdicts.every(Boolean);
  } finally {
    await rm(inputDirectory, { recursive: true, force: true });
  }
}

function verifyScenarioOutput(scenario: Scenario, output: CandidateOutput, deterministic: boolean): ScenarioVerdict {
  const details: string[] = [];
  const plans: readonly unknown[] = isRecord(output) && Array.isArray(output.plans) ? output.plans : [];
  const planIds = plans.map((plan) => isRecord(plan) && typeof plan.id === "string" ? plan.id : null);
  const schema = isRecord(output) && output.scenarioId === scenario.id && plans.length >= scenario.requiredAlternatives
    && planIds.every((id): id is string => typeof id === "string" && id.trim().length > 0) && new Set(planIds).size === planIds.length
    && plans.every((plan) => isRecord(plan) && Array.isArray(plan.assignments) && Array.isArray(plan.unassignedPickupIds));
  if (!schema) details.push("result schema or required plan count is invalid");
  const validations = plans.map((plan) => validatePlan(scenario, plan));
  const route = validations.length >= scenario.requiredAlternatives && validations.every((value) => value.route);
  const capacity = validations.length >= scenario.requiredAlternatives && validations.every((value) => value.capacity);
  const deadlineBoundaryServed = scenario.id !== "deadline-boundary" || plans.every((plan) => isRecord(plan) && Array.isArray(plan.assignments) && plan.assignments.length === scenario.pickups.length);
  const timing = validations.length >= scenario.requiredAlternatives && validations.every((value) => value.timing) && deadlineBoundaryServed;
  const priority = validations.length >= scenario.requiredAlternatives && validations.every((value) => value.priority);
  const conservation = validations.length >= scenario.requiredAlternatives && validations.every((value) => value.conservation);
  const signatures = validations.map((value) => value.signature);
  const alternatives = validations.length >= scenario.requiredAlternatives && new Set(signatures).size >= scenario.requiredAlternatives;
  for (const validation of validations) details.push(...validation.details);
  if (!alternatives) details.push("plans are not materially distinct");
  return { invocation: true, deterministic, schema, route, capacity, timing, priority, alternatives, conservation, details: [...new Set(details)] };
}

function validatePlan(scenario: Scenario, plan: unknown): { route: boolean; capacity: boolean; timing: boolean; priority: boolean; conservation: boolean; signature: string; details: string[] } {
  const details: string[] = [];
  if (!isRecord(plan)) return { route: false, capacity: false, timing: false, priority: false, conservation: false, signature: "malformed-plan", details: ["plan is not an object"] };
  const rawAssignments: readonly unknown[] = Array.isArray(plan.assignments) ? plan.assignments : [];
  const assignments = rawAssignments.filter(isRecord) as Assignment[];
  const assignmentShape = assignments.length === rawAssignments.length;
  const rawUnassigned: readonly unknown[] = Array.isArray(plan.unassignedPickupIds) ? plan.unassignedPickupIds : [];
  const unassigned = rawUnassigned.filter((id): id is string => typeof id === "string");
  const unassignedShape = unassigned.length === rawUnassigned.length;
  const pickupMap = new Map(scenario.pickups.map((pickup) => [pickup.id, pickup]));
  const vehicleMap = new Map(scenario.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const shelterMap = new Map(scenario.shelters.map((shelter) => [shelter.id, shelter]));
  const streetMap = new Map(scenario.streets.map((street) => [street.id, street]));
  const closed = new Set(scenario.closedStreetIds);
  const pickupIds = assignments.map(({ pickupId }) => pickupId).filter((id): id is string => typeof id === "string");
  const vehicleIds = assignments.map(({ vehicleId }) => vehicleId).filter((id): id is string => typeof id === "string");
  let route = assignmentShape; let capacity = assignmentShape; let timing = assignmentShape;
  if (!assignmentShape) details.push("assignment is not an object");
  const arrivals = new Map<string, number>();
  const shelterLoads = new Map<string, { people: number; wheelchair: number }>();
  const signatures: string[] = [];
  for (const assignment of assignments) {
    const pickup = typeof assignment.pickupId === "string" ? pickupMap.get(assignment.pickupId) : undefined;
    const vehicle = typeof assignment.vehicleId === "string" ? vehicleMap.get(assignment.vehicleId) : undefined;
    const shelter = typeof assignment.shelterId === "string" ? shelterMap.get(assignment.shelterId) : undefined;
    if (!pickup || !vehicle || !shelter) { route = capacity = timing = false; details.push("assignment references an unknown entity"); continue; }
    const first = replayRoute(vehicle.startNodeId, assignment.toPickupStreetIds, streetMap, closed);
    const second = replayRoute(pickup.nodeId, assignment.toShelterStreetIds, streetMap, closed);
    if (!first.ok || first.end !== pickup.nodeId || !second.ok || second.end !== shelter.nodeId) { route = false; details.push(`${pickup.id} has an illegal or misdirected route`); }
    const startAt = integer(assignment.startAt); const pickupAt = integer(assignment.pickupAt); const arriveAt = integer(assignment.arriveAt);
    if (startAt === null || pickupAt === null || arriveAt === null || startAt < vehicle.availableAt || pickupAt !== startAt + first.minutes || pickupAt < pickup.readyAt || arriveAt !== pickupAt + scenario.boardingMinutes + second.minutes || arriveAt > pickup.deadline) { timing = false; details.push(`${pickup.id} has invalid recomputed timing`); }
    if (pickup.people > vehicle.capacity || pickup.wheelchairUsers > vehicle.wheelchairCapacity) { capacity = false; details.push(`${pickup.id} exceeds ${vehicle.id} capacity or accessibility`); }
    const load = shelterLoads.get(shelter.id) ?? { people: 0, wheelchair: 0 };
    load.people += pickup.people; load.wheelchair += pickup.wheelchairUsers; shelterLoads.set(shelter.id, load);
    if (arriveAt !== null) arrivals.set(pickup.id, arriveAt);
    signatures.push(`${pickup.id}:${vehicle.id}:${shelter.id}:${JSON.stringify(assignment.toPickupStreetIds)}:${JSON.stringify(assignment.toShelterStreetIds)}`);
  }
  for (const [shelterId, load] of shelterLoads) { const shelter = shelterMap.get(shelterId)!; if (load.people > shelter.capacity || load.wheelchair > shelter.wheelchairCapacity) { capacity = false; details.push(`${shelterId} shelter capacity exceeded`); } }
  for (const assignment of assignments) {
    const pickup = typeof assignment.pickupId === "string" ? pickupMap.get(assignment.pickupId) : undefined;
    const pickupAt = integer(assignment.pickupAt);
    if (pickup && pickup.dependsOn.some((id) => !arrivals.has(id) || pickupAt === null || arrivals.get(id)! > pickupAt)) { timing = false; details.push(`${pickup.id} violates pickup dependency precedence`); }
  }
  const allIds = scenario.pickups.map(({ id }) => id);
  const exactComplement = unassignedShape && unassigned.length === new Set(unassigned).size && [...unassigned].sort().join("|") === allIds.filter((id) => !pickupIds.includes(id)).sort().join("|");
  const conservation = assignmentShape && pickupIds.length === new Set(pickupIds).size && vehicleIds.length === new Set(vehicleIds).size && pickupIds.every((id) => pickupMap.has(id)) && exactComplement && pickupIds.length + unassigned.length === allIds.length;
  if (!conservation) details.push("pickup, vehicle, or unassigned conservation failed");
  const expectedCounts = scenario.id === "priority-scarcity" ? [1, 1, 0] : [1, 1, 1];
  const actualCounts = (["critical", "high", "standard"] as const).map((priorityName) => pickupIds.filter((id) => pickupMap.get(id)?.priority === priorityName).length);
  const priority = actualCounts.every((count, index) => count === expectedCounts[index]);
  if (!priority) details.push("a lower-priority group displaced a higher-priority group");
  return { route, capacity, timing, priority, conservation, signature: signatures.sort().join("|"), details };
}

function replayRoute(start: string, value: unknown, streets: ReadonlyMap<string, Street>, closed: ReadonlySet<string>): { ok: boolean; end: string; minutes: number } {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) return { ok: false, end: start, minutes: 0 };
  let node = start; let minutes = 0; let ok = true;
  for (const id of value as string[]) { const street = streets.get(id); if (!street || closed.has(id) || (street.a !== node && street.b !== node)) { ok = false; continue; } node = street.a === node ? street.b : street.a; minutes += street.minutes; }
  return { ok, end: node, minutes };
}

function integer(value: unknown): number | null { return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function failedVerdict(detail: string): ScenarioVerdict { return { invocation: false, deterministic: false, schema: false, route: false, capacity: false, timing: false, priority: false, alternatives: false, conservation: false, details: [detail] }; }

async function verifyDependencyPolicy(workspace: string): Promise<boolean> {
  try {
    const manifest = JSON.parse(await readFile(join(workspace, "package.json"), "utf8")) as Record<string, unknown>;
    const dependencyMapsValid = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].every((field) => {
      if (!(field in manifest)) return true;
      const value = manifest[field];
      return isRecord(value) && !Array.isArray(value) && Object.keys(value).length === 0;
    });
    const bundledDependenciesValid = ["bundleDependencies", "bundledDependencies"].every((field) => {
      if (!(field in manifest)) return true;
      const value = manifest[field];
      return Array.isArray(value) && value.length === 0;
    });
    let vendoredModulesAbsent = false;
    try { await access(join(workspace, "node_modules")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") vendoredModulesAbsent = true; else throw error; }
    return dependencyMapsValid && bundledDependenciesValid && vendoredModulesAbsent;
  } catch { return false; }
}

async function verifyContainedWorkspaceTree(workspace: string): Promise<void> {
  const workspaceRoot = await realpath(workspace);
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Workspace symlinks are not allowed during qualification: ${path}.`);
      if (entry.isDirectory()) await visit(path);
    }
  };
  await visit(workspaceRoot);
}

async function requireContainedRegularFile(workspace: string, relativePath: string): Promise<void> {
  const workspaceRoot = await realpath(workspace);
  const resolved = await realpath(join(workspaceRoot, relativePath));
  const within = relative(workspaceRoot, resolved);
  if (within.startsWith("..") || isAbsolute(within) || !(await lstat(resolved)).isFile()) throw new Error(`${relativePath} must resolve to a regular file inside the committed verifier tree.`);
}

async function requirePinnedNodeRuntime(nodeExecutable: string, cwd: string, runCommand: CommandRunner): Promise<AuthenticatedEmergencyNodeRuntime> {
  if (!isAbsolute(nodeExecutable)) throw new Error("The emergency evacuation grader requires an absolute pinned standalone Node executable.");
  const resolved = await realpath(nodeExecutable);
  if (!(await lstat(resolved)).isFile()) throw new Error("The emergency evacuation Node 22 executable must be a regular file.");
  const executableDigest = await digestFile(resolved);
  if (executableDigest !== EMERGENCY_EVACUATION_NODE_RUNTIME.executableDigest) {
    throw new Error(`Emergency evacuation Node executable digest mismatch: expected ${EMERGENCY_EVACUATION_NODE_RUNTIME.executableDigest}, received ${executableDigest}.`);
  }
  const result = await required(runCommand, resolved, ["--input-type=module", "--eval", "console.log(JSON.stringify({ executable: process.execPath, release: process.release.name, version: process.versions.node, platform: process.platform, architecture: process.arch }))"], cwd);
  let identity: { readonly executable?: unknown; readonly release?: unknown; readonly version?: unknown; readonly platform?: unknown; readonly architecture?: unknown };
  try { identity = JSON.parse(result.stdout.trim()) as typeof identity; } catch { throw new Error("The emergency evacuation executable did not identify itself as Node."); }
  if (identity.release !== "node" || identity.version !== EMERGENCY_EVACUATION_NODE_RUNTIME.version || identity.platform !== EMERGENCY_EVACUATION_NODE_RUNTIME.platform || identity.architecture !== EMERGENCY_EVACUATION_NODE_RUNTIME.architecture || typeof identity.executable !== "string" || await realpath(identity.executable) !== resolved) {
    throw new Error(`The emergency evacuation case requires Node ${EMERGENCY_EVACUATION_NODE_RUNTIME.version} on ${EMERGENCY_EVACUATION_NODE_RUNTIME.platform}/${EMERGENCY_EVACUATION_NODE_RUNTIME.architecture}, received ${String(identity.release)} ${String(identity.version)} ${String(identity.platform)}/${String(identity.architecture)}.`);
  }
  return Object.freeze({ path: resolved, version: EMERGENCY_EVACUATION_NODE_RUNTIME.version, platform: EMERGENCY_EVACUATION_NODE_RUNTIME.platform, architecture: EMERGENCY_EVACUATION_NODE_RUNTIME.architecture, executableDigest });
}

async function digestFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return `sha256:${hash.digest("hex")}`;
}

async function runCandidateCli(workspace: string, inputPath: string, inputDirectory: string, nodeExecutable: string, runCommand: CommandRunner): Promise<CommandResult> {
  const [workspaceRoot, inputRoot, resolvedInput] = await Promise.all([realpath(workspace), realpath(inputDirectory), realpath(inputPath)]);
  const profilePath = join(inputRoot, "candidate.sb");
  await writeFile(profilePath, candidateSeatbeltProfile(workspaceRoot, inputRoot, nodeExecutable), "utf8");
  return runCommand("/usr/bin/sandbox-exec", ["-f", profilePath, nodeExecutable, "src/cli.js", resolvedInput], {
    cwd: workspaceRoot,
    env: { PATH: "/usr/bin:/bin", HOME: workspaceRoot, TMPDIR: workspaceRoot, LANG: "C", LC_ALL: "C", OPENSSL_CONF: "/dev/null" },
  });
}

function candidateSeatbeltProfile(workspace: string, inputDirectory: string, nodeExecutable: string): string {
  const readPaths = [workspace, inputDirectory, nodeExecutable, "/System/Library", "/System/Volumes/Preboot/Cryptexes/OS", "/usr/lib", "/dev", "/private/var/db/timezone"];
  const ancestors = new Set<string>(["/"]);
  for (const path of readPaths) { let parent = dirname(path); while (true) { ancestors.add(parent); const next = dirname(parent); if (next === parent) break; parent = next; } }
  return [
    "(version 1)",
    "(deny default)",
    "(deny network*)",
    "(allow process*)",
    "(deny process-fork)",
    "(deny process-exec)",
    "(allow signal (target self))",
    "(allow sysctl-read)",
    "(allow mach-lookup)",
    "(allow file-read-metadata)",
    ...[...ancestors].sort().map((path) => `(allow file-read-data (literal ${sandboxLiteral(path)}))`),
    ...readPaths.flatMap((path) => [`(allow file-read* (literal ${sandboxLiteral(path)}))`, `(allow file-read* (subpath ${sandboxLiteral(path)}))`]),
    `(allow file-write* (literal ${sandboxLiteral(workspace)}))`,
    `(allow file-write* (subpath ${sandboxLiteral(workspace)}))`,
    `(allow process-exec (literal ${sandboxLiteral(nodeExecutable)}))`,
    "",
  ].join("\n");
}


function sandboxLiteral(path: string): string {
  if (!isAbsolute(path) || path.includes("\0") || path.includes("\n") || path.includes("\r") || path.includes('"')) throw new Error("Unsafe Seatbelt path.");
  return JSON.stringify(path);
}

async function writeFixtureFiles(workspaceDirectory: string): Promise<void> {
  await mkdir(workspaceDirectory, { recursive: true, mode: 0o700 });
  for (const [relativePath, contents] of Object.entries(starterFiles)) { const target = join(workspaceDirectory, relativePath); await mkdir(dirname(target), { recursive: true, mode: 0o700 }); await writeFile(target, contents, "utf8"); }
}
async function requireMissing(path: string): Promise<void> { try { await access(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; } throw new Error(`Refusing to overwrite existing emergency evacuation workspace: ${path}`); }
async function required(runCommand: CommandRunner, command: string, args: readonly string[], cwd: string, environment: Readonly<Record<string, string>> = {}): Promise<CommandResult> { const result = await runCommand(command, args, { cwd, env: { ...process.env, ...environment } as Readonly<Record<string, string>> }); if (result.exitCode !== 0) throw new Error(`${command} ${args.join(" ")} failed (${result.exitCode}): ${(result.stderr || result.stdout).trim()}`); return result; }
function lines(value: string): string[] { return value.split("\n").map((line) => line.trim()).filter(Boolean); }
const execFileAsync = promisify(execFile);
async function run(command: string, args: readonly string[], options: { readonly cwd: string; readonly env?: Readonly<Record<string, string>> }): Promise<CommandResult> { try { const result = await execFileAsync(command, [...args], { cwd: options.cwd, env: options.env ? { ...options.env } : process.env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, timeout: 60_000 }); return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }; } catch (error) { const failure = error as Error & { code?: number; stdout?: string; stderr?: string }; return { exitCode: typeof failure.code === "number" ? failure.code : 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? failure.message }; } }
