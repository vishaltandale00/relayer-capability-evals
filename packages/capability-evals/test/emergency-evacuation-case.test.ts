import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  EMERGENCY_EVACUATION_CASE_ID,
  EMERGENCY_EVACUATION_NODE_RUNTIME,
  EMERGENCY_EVACUATION_VERIFIER_SOURCE_SHA256,
  emergencyEvacuationCase,
  emergencyEvacuationMandatoryGateChecks,
  evaluateEmergencyEvacuationMandatoryGate,
  gradeEmergencyEvacuationWorkspace,
  materializeEmergencyEvacuationFixture,
  preflightEmergencyEvacuationEnvironment,
} from "../src/project-cases/emergency-evacuation-case.js";
import type { CommandRunner } from "@relayer/eval-runner";

const temporaryDirectories: string[] = [];
const execFileAsync = promisify(execFile);
const runtimeAvailability = await inspectPinnedRuntimeAvailability();
const runtimeIt = runtimeAvailability.available ? it : it.skip;
const admissionCheckNames = [
  "workspace:public-interface:invocation", "workspace:runtime:node-executable", "workspace:public-interface:determinism",
  "workspace:public-interface:invalid-input", "workspace:route-legality", "workspace:capacity-accessibility",
  "workspace:timing-dependencies", "workspace:priority-alternatives:priority", "workspace:priority-alternatives:alternatives",
  "workspace:conservation-delivery:conservation", "workspace:conservation-delivery:built-ins-only",
  "workspace:conservation-delivery:commit", "workspace:conservation-delivery:clean",
] as const;

function expectExactAdmissionFailures(checks: readonly { name: string; passed: boolean }[], expectedFailures: readonly string[], chapter?: string) {
  const names = checks.map(({ name }) => name);
  const failures = checks.filter(({ passed }) => !passed).map(({ name }) => name);
  if (chapter) {
    expect.soft(names, `${chapter} check roster: ${JSON.stringify(checks)}`).toEqual(admissionCheckNames);
    expect.soft(failures, `${chapter} intended failures: ${JSON.stringify(checks)}`).toEqual(expectedFailures);
  } else {
    expect(names).toEqual(admissionCheckNames);
    expect(failures).toEqual(expectedFailures);
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "relayer-evacuation-test-"));
  temporaryDirectories.push(root);
  const workspaceDirectory = join(root, "workspace");
  const receipt = await materializeEmergencyEvacuationFixture({ workspaceDirectory });
  return { workspaceDirectory, receipt };
}

async function inspectPinnedRuntimeAvailability(): Promise<{ available: boolean; reason: string }> {
  if (process.platform !== EMERGENCY_EVACUATION_NODE_RUNTIME.platform) return { available: false, reason: `requires ${EMERGENCY_EVACUATION_NODE_RUNTIME.platform}, found ${process.platform}` };
  if (process.arch !== EMERGENCY_EVACUATION_NODE_RUNTIME.architecture) return { available: false, reason: `requires ${EMERGENCY_EVACUATION_NODE_RUNTIME.architecture}, found ${process.arch}` };
  if (process.version !== `v${EMERGENCY_EVACUATION_NODE_RUNTIME.version}`) return { available: false, reason: `requires Node ${EMERGENCY_EVACUATION_NODE_RUNTIME.version}, found ${process.version}` };
  try {
    const executable = await realpath(process.execPath);
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(executable)) hash.update(chunk);
    const actual = `sha256:${hash.digest("hex")}`;
    if (actual !== EMERGENCY_EVACUATION_NODE_RUNTIME.executableDigest) return { available: false, reason: `Node executable digest is ${actual}` };
    await access("/usr/bin/sandbox-exec");
    return { available: true, reason: "pinned Node and macOS sandbox are available" };
  } catch (error) {
    return { available: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function installSolver(workspaceDirectory: string, fixtureName: string) {
  const source = await readFile(join(import.meta.dirname, "fixtures/emergency-evacuation", fixtureName), "utf8");
  await writeFile(join(workspaceDirectory, "src/cli.js"), source, "utf8");
  await execFileAsync("git", ["add", "--all"], { cwd: workspaceDirectory });
  await execFileAsync("git", ["commit", "--quiet", "-m", `Implement planner with ${fixtureName}`], { cwd: workspaceDirectory });
}

async function installSource(workspaceDirectory: string, source: string, message = "Install evaluator test candidate") {
  await writeFile(join(workspaceDirectory, "src/cli.js"), source, "utf8");
  await execFileAsync("git", ["add", "--all"], { cwd: workspaceDirectory });
  await execFileAsync("git", ["commit", "--quiet", "-m", message], { cwd: workspaceDirectory });
}

describe("emergency evacuation capability case", () => {
  it("publishes one immutable candidate snapshot", () => {
    expect(emergencyEvacuationCase.definition.id).toBe(EMERGENCY_EVACUATION_CASE_ID);
    expect(emergencyEvacuationCase.snapshot.authoringStatus).toBe("candidate");
    expect(emergencyEvacuationCase.snapshot.artifacts.verifier.mandatoryGates.map(({ id }) => id)).toEqual([
      "runtime-authority",
      "public-interface",
      "route-legality",
      "capacity-accessibility",
      "timing-dependencies",
      "priority-alternatives",
      "conservation-delivery",
    ]);
    expect(JSON.stringify(emergencyEvacuationCase.catalogSnapshot)).not.toContain("sealedPath");
    expect(EMERGENCY_EVACUATION_NODE_RUNTIME).toEqual({
      version: "22.23.2",
      platform: "darwin",
      architecture: "arm64",
      executableDigest: "sha256:18e387c90ab8a8400183e8bdd396376e1e875b91b4c874b894dcade7b35bf572",
    });
  });

  it("binds verifier identity to normalized complete source across TS and dist loaders", async () => {
    const source = await readFile(join(import.meta.dirname, "../src/project-cases/emergency-evacuation-case.ts"), "utf8");
    const normalized = source.replace(
      /export const EMERGENCY_EVACUATION_VERIFIER_SOURCE_SHA256 = "[a-f0-9]{64}";/,
      'export const EMERGENCY_EVACUATION_VERIFIER_SOURCE_SHA256 = "<normalized>";',
    );
    expect(normalized).not.toBe(source);
    expect(createHash("sha256").update(normalized).digest("hex")).toBe(EMERGENCY_EVACUATION_VERIFIER_SOURCE_SHA256);
    const compiled = await import(pathToFileURL(join(import.meta.dirname, "../dist/project-cases/emergency-evacuation-case.js")).href);
    expect(compiled.emergencyEvacuationCase.snapshotDigest).toBe(emergencyEvacuationCase.snapshotDigest);
    expect(compiled.emergencyEvacuationCase.snapshot.artifacts.verifier.contentDigest).toBe(emergencyEvacuationCase.snapshot.artifacts.verifier.contentDigest);
    expect(compiled.emergencyEvacuationCase.snapshot.artifacts.workspace.environmentDigest).toBe(emergencyEvacuationCase.snapshot.artifacts.workspace.environmentDigest);
  });

  it("binds the admission driver to executed runtime bytes and durable evidence hashes", async () => {
    const runner = await readFile(join(import.meta.dirname, "../../../scripts/verify-emergency-evacuation-admission.mjs"), "utf8");
    expect(runner).toContain('"packages/capability-evals/dist/project-cases/emergency-evacuation-case.js"');
    expect(runner).toContain('"packages/capability-evals/dist/index.js"');
    expect(runner).toContain("sourceInputsAfter");
    expect(runner).toContain('evidenceFile(reportPath, "vitest-report.json")');
    expect(runner).toContain('evidenceFile(logPath, "vitest-raw.log")');
  });

  it("rejects an unpinned executable before invoking it", async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-evacuation-runtime-test-"));
    temporaryDirectories.push(root);
    const executable = join(root, "node");
    await writeFile(executable, "not the pinned Node executable", "utf8");
    let executed = false;
    const runCommand: CommandRunner = async () => {
      executed = true;
      return { exitCode: 1, stdout: "", stderr: "must not run" };
    };
    const rejected = await preflightEmergencyEvacuationEnvironment({ nodeExecutable: executable, cwd: root, runCommand });
    expect(rejected).toMatchObject({ available: false, reason: expect.stringContaining("digest mismatch") });
    expect(executed).toBe(false);

  });

  runtimeIt(`reports pinned runtime identity (${runtimeAvailability.reason})`, async () => {
    const root = await mkdtemp(join(tmpdir(), "relayer-evacuation-runtime-test-"));
    temporaryDirectories.push(root);
    const accepted = await preflightEmergencyEvacuationEnvironment({ nodeExecutable: process.execPath, cwd: root });
    expect(accepted).toMatchObject({
      available: true,
      runtime: {
        version: EMERGENCY_EVACUATION_NODE_RUNTIME.version,
        platform: EMERGENCY_EVACUATION_NODE_RUNTIME.platform,
        architecture: EMERGENCY_EVACUATION_NODE_RUNTIME.architecture,
        executableDigest: EMERGENCY_EVACUATION_NODE_RUNTIME.executableDigest,
        environmentDigest: emergencyEvacuationCase.snapshot.artifacts.workspace.environmentDigest,
      },
    });
    if (accepted.available) expect(accepted.runtime).not.toHaveProperty("path");
  });

  it("exposes materialization and public-seam grading", () => {
    expect(materializeEmergencyEvacuationFixture).toBeTypeOf("function");
    expect(gradeEmergencyEvacuationWorkspace).toBeTypeOf("function");
  });

  it("digest-binds complete and failed mandatory-gate qualification", () => {
    const checks = Object.values(emergencyEvacuationMandatoryGateChecks).flat().map((suffix) => ({ name: `thread:delivery:workspace:${suffix}`, passed: true, detail: "pass" }));
    expect(evaluateEmergencyEvacuationMandatoryGate("public-interface", checks)).toMatchObject({ complete: true, passed: true });
    expect(evaluateEmergencyEvacuationMandatoryGate("public-interface", checks.filter((check) => !check.name.endsWith(":public-interface:invocation")))).toMatchObject({ complete: false, passed: false });
    expect(evaluateEmergencyEvacuationMandatoryGate("public-interface", checks.map((check) => check.name.endsWith(":public-interface:invocation") ? { ...check, passed: false } : check))).toMatchObject({ complete: true, passed: false });
    expect(evaluateEmergencyEvacuationMandatoryGate("unrelated", checks)).toBeNull();
  });

  runtimeIt("materializes a clean, content-addressed greenfield repository", async () => {
    const { workspaceDirectory, receipt } = await fixture();
    expect(receipt).toMatchObject({
      fixtureId: EMERGENCY_EVACUATION_CASE_ID,
      repositoryUrl: emergencyEvacuationCase.snapshot.artifacts.workspace.source,
      sourceRevision: emergencyEvacuationCase.snapshot.artifacts.workspace.revision,
      seededCommit: expect.stringMatching(/^[a-f0-9]{40}$/),
      seededTree: "d8e3c7d29fe53d0e9bb12553f57e53301d551f38",
      contentDigest: emergencyEvacuationCase.snapshot.artifacts.workspace.contentDigest,
      environmentDigest: emergencyEvacuationCase.snapshot.artifacts.workspace.environmentDigest,
      packageManager: "node@22",
    });
    expect(await readFile(join(workspaceDirectory, "README.md"), "utf8")).toContain("lexicographically by critical");
    expect((await execFileAsync("git", ["status", "--porcelain"], { cwd: workspaceDirectory })).stdout).toBe("");
  });

  runtimeIt("keeps the untouched baseline red for independently attributed behavioral reasons", async () => {
    const { workspaceDirectory, receipt } = await fixture();
    const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
    expectExactAdmissionFailures(checks, [
      "workspace:public-interface:invocation",
      "workspace:public-interface:determinism",
      "workspace:route-legality",
      "workspace:capacity-accessibility",
      "workspace:timing-dependencies",
      "workspace:priority-alternatives:priority",
      "workspace:priority-alternatives:alternatives",
      "workspace:conservation-delivery:conservation",
      "workspace:conservation-delivery:commit",
    ]);
  });

  it("rejects execution outside the declared local Mac environment", async () => {
    await expect(materializeEmergencyEvacuationFixture({ workspaceDirectory: "/unused/evacuation", platform: "linux" })).rejects.toThrow("local Mac only");
  });

  runtimeIt("accepts two materially different reasonable planners through only the public seam", async () => {
    const decisionSets: string[][] = [];
    for (const fixtureName of ["exhaustive-solver.mjs", "priority-first-solver.mjs"]) {
      const { workspaceDirectory, receipt } = await fixture();
      await installSolver(workspaceDirectory, fixtureName);
      const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
      expect(checks.every(({ passed }) => passed), `${fixtureName}: ${JSON.stringify(checks)}`).toBe(true);
      expect(await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit })).toEqual(checks);
      const result = await execFileAsync(process.execPath, ["src/cli.js", "fixtures/harbor-fire.json"], { cwd: workspaceDirectory });
      const output = JSON.parse(result.stdout) as { plans: Array<{ assignments: unknown[] }> };
      decisionSets.push(output.plans.map(({ assignments }) => JSON.stringify(assignments)).sort());
    }
    expect(decisionSets[0]).not.toEqual(decisionSets[1]);
  }, 30_000);

  runtimeIt("rejects shortcut mutants with independent predicate evidence", async () => {
    const correct = await readFile(join(import.meta.dirname, "fixtures/emergency-evacuation/exhaustive-solver.mjs"), "utf8");
    const priorityFirst = await readFile(join(import.meta.dirname, "fixtures/emergency-evacuation/priority-first-solver.mjs"), "utf8");
    const mutants = [
      {
        name: "closure-blind",
        source: correct.replace("if (closed.has(street.id)) continue;", ""),
        rejectedBy: "workspace:route-legality",
      },
      {
        name: "directed-streets",
        source: correct.replace("street.a === node ? street.b : street.b === node ? street.a : null", "street.a === node ? street.b : null"),
        rejectedBy: "workspace:route-legality",
      },
      {
        name: "accessibility-blind",
        source: correct
          .replace("if (pickup.people > vehicle.capacity || pickup.wheelchairUsers > vehicle.wheelchairCapacity) continue;", "")
          .replace("if (pickup.people > shelter.capacity || pickup.wheelchairUsers > shelter.wheelchairCapacity) continue;", ""),
        rejectedBy: "workspace:capacity-accessibility",
      },
      {
        name: "capacity-blind",
        source: correct.replace("assignments: candidate.assignments,", "assignments: candidate.assignments.map((assignment) => assignment.pickupId === 'school-group' ? { ...assignment, vehicleId: 'accessible-south' } : assignment),"),
        rejectedBy: "workspace:capacity-accessibility",
      },
      {
        name: "dependency-blind",
        source: correct.replace(", ...dependencyArrivals);", ");"),
        rejectedBy: "workspace:timing-dependencies",
      },
      {
        name: "readiness-blind",
        source: correct
          .replace("Math.max(vehicle.availableAt + first.minutes, pickup.readyAt)", "first.minutes")
          .replace("Math.max(option.vehicle.availableAt + option.first.minutes, option.pickup.readyAt, ...dependencyArrivals)", "Math.max(option.first.minutes, ...dependencyArrivals)"),
        rejectedBy: "workspace:timing-dependencies",
      },
      {
        name: "exclusive-deadline",
        source: correct.replace("arriveAt <= pickup.deadline", "arriveAt < pickup.deadline").replace("arriveAt > option.pickup.deadline", "arriveAt >= option.pickup.deadline"),
        rejectedBy: "workspace:timing-dependencies",
      },
      {
        name: "low-priority-first",
        source: correct.replace("for (let index = 0; index < 3; index += 1)", "for (let index = 2; index >= 0; index -= 1)"),
        rejectedBy: "workspace:priority-alternatives:priority",
      },
      {
        name: "priority-blind-input-order",
        source: priorityFirst.replace("const pickups = [...scenario.pickups].sort((a, b) => priorities[a.priority] - priorities[b.priority] || a.id.localeCompare(b.id));", "const pickups = [...scenario.pickups];"),
        rejectedBy: "workspace:priority-alternatives:priority",
      },
      {
        name: "priority-blind-id-order",
        source: priorityFirst.replace("priorities[a.priority] - priorities[b.priority] || a.id.localeCompare(b.id)", "a.id.localeCompare(b.id)"),
        rejectedBy: "workspace:priority-alternatives:priority",
      },
      {
        name: "hard-coded-dependency-topology",
        source: correct.replaceAll("option.pickup.dependsOn", "(option.pickup.id === 'apartment-residents' ? ['clinic-patients'] : [])"),
        rejectedBy: "workspace:timing-dependencies",
      },
      {
        name: "single-alternative",
        source: correct.replace(".slice(0, scenario.requiredAlternatives);", ".slice(0, 1);"),
        rejectedBy: "workspace:priority-alternatives:alternatives",
      },
      {
        name: "duplicate-plan-ids",
        source: correct.replace("id: `exhaustive-${index + 1}`", 'id: "same-plan"'),
        rejectedBy: "workspace:public-interface:invocation",
      },
      {
        name: "hard-coded-two-alternatives",
        source: correct.replace(".slice(0, scenario.requiredAlternatives);", ".slice(0, 2);"),
        rejectedBy: "workspace:priority-alternatives:alternatives",
      },
      {
        name: "duplicate-pickup",
        source: correct.replace("assignments: candidate.assignments,", "assignments: [...candidate.assignments, candidate.assignments[0]],"),
        rejectedBy: "workspace:conservation-delivery:conservation",
      },
      {
        name: "non-string-unassigned",
        source: correct.replace("unassignedPickupIds: allPickupIds.filter((id) => !candidate.assignments.some(({ pickupId }) => pickupId === id)).sort(),", "unassignedPickupIds: [...allPickupIds.filter((id) => !candidate.assignments.some(({ pickupId }) => pickupId === id)).sort(), null],"),
        rejectedBy: "workspace:conservation-delivery:conservation",
      },
      {
        name: "aggregate-shelter-capacity-blind",
        source: correct.replace("if (load.people > option.shelter.capacity || load.wheelchair > option.shelter.wheelchairCapacity) return null;", ""),
        rejectedBy: "workspace:capacity-accessibility",
      },
      {
        name: "invalid-input-blind",
        source: correct.replace("validateScenario(scenario);", ""),
        rejectedBy: "workspace:public-interface:invalid-input",
      },
    ];
    const exactOneAnchors = [
      [correct, "if (closed.has(street.id)) continue;"],
      [correct, "street.a === node ? street.b : street.b === node ? street.a : null"],
      [correct, "if (pickup.people > vehicle.capacity || pickup.wheelchairUsers > vehicle.wheelchairCapacity) continue;"],
      [correct, "if (pickup.people > shelter.capacity || pickup.wheelchairUsers > shelter.wheelchairCapacity) continue;"],
      [correct, "assignments: candidate.assignments,"],
      [correct, ", ...dependencyArrivals);"],
      [correct, "Math.max(vehicle.availableAt + first.minutes, pickup.readyAt)"],
      [correct, "Math.max(option.vehicle.availableAt + option.first.minutes, option.pickup.readyAt, ...dependencyArrivals)"],
      [correct, "arriveAt <= pickup.deadline"],
      [correct, "arriveAt > option.pickup.deadline"],
      [correct, "for (let index = 0; index < 3; index += 1)"],
      [priorityFirst, "const pickups = [...scenario.pickups].sort((a, b) => priorities[a.priority] - priorities[b.priority] || a.id.localeCompare(b.id));"],
      [priorityFirst, "priorities[a.priority] - priorities[b.priority] || a.id.localeCompare(b.id)"],
      [correct, ".slice(0, scenario.requiredAlternatives);"],
      [correct, "id: `exhaustive-${index + 1}`"],
      [correct, "unassignedPickupIds: allPickupIds.filter((id) => !candidate.assignments.some(({ pickupId }) => pickupId === id)).sort(),"],
      [correct, "if (load.people > option.shelter.capacity || load.wheelchair > option.shelter.wheelchairCapacity) return null;"],
      [correct, "validateScenario(scenario);"],
    ] as const;
    for (const [source, anchor] of exactOneAnchors) expect(source.split(anchor), anchor).toHaveLength(2);
    expect(correct.split("option.pickup.dependsOn").length - 1).toBeGreaterThan(0);
    for (const mutant of mutants) {
      expect(mutant.source, mutant.name).not.toBe(correct);
      const { workspaceDirectory, receipt } = await fixture();
      await installSource(workspaceDirectory, mutant.source, `Install ${mutant.name} mutant`);
      const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
      const expectedFailures = mutant.name === "closure-blind"
        // A closed edge is both illegal and excluded from the evaluator's recomputed travel time.
        ? ["workspace:route-legality", "workspace:timing-dependencies"]
        : mutant.name === "directed-streets"
          // One-way traversal removes the required plan count, so schema and all count-gated validations fail.
          ? [
              "workspace:public-interface:invocation",
              "workspace:route-legality",
              "workspace:capacity-accessibility",
              "workspace:timing-dependencies",
              "workspace:priority-alternatives:priority",
              "workspace:priority-alternatives:alternatives",
              "workspace:conservation-delivery:conservation",
            ]
        : mutant.name === "capacity-blind"
          // Rewriting the vehicle changes its start/accessibility, duplicates its use, and collapses otherwise distinct plan signatures.
          ? [
              "workspace:route-legality",
              "workspace:capacity-accessibility",
              "workspace:timing-dependencies",
              "workspace:priority-alternatives:alternatives",
              "workspace:conservation-delivery:conservation",
            ]
        : mutant.name === "exclusive-deadline"
          // Excluding the exact boundary drops its pickup and therefore changes the expected served-priority counts.
          ? ["workspace:timing-dependencies", "workspace:priority-alternatives:priority"]
        : mutant.name === "duplicate-pickup"
          // The copied assignment duplicates shelter load, vehicle timing, its priority-class count, and pickup conservation.
          ? [
              "workspace:capacity-accessibility",
              "workspace:timing-dependencies",
              "workspace:priority-alternatives:priority",
              "workspace:conservation-delivery:conservation",
            ]
        : ["single-alternative", "hard-coded-two-alternatives"].includes(mutant.name)
          // Too few plans fail schema and every validation that requires the declared alternative count.
          ? [
              "workspace:public-interface:invocation",
              "workspace:route-legality",
              "workspace:capacity-accessibility",
              "workspace:timing-dependencies",
              "workspace:priority-alternatives:priority",
              "workspace:priority-alternatives:alternatives",
              "workspace:conservation-delivery:conservation",
            ]
          : [mutant.rejectedBy];
      expectExactAdmissionFailures(checks, expectedFailures, mutant.name);
    }
  }, 180_000);

  runtimeIt("rejects committed symlinks to uncommitted external implementation code", async () => {
    const { workspaceDirectory, receipt } = await fixture();
    const externalSolver = join(workspaceDirectory, "..", "external-solver.mjs");
    await writeFile(externalSolver, await readFile(join(import.meta.dirname, "fixtures/emergency-evacuation/exhaustive-solver.mjs"), "utf8"), "utf8");
    await rm(join(workspaceDirectory, "src/cli.js"));
    await symlink(externalSolver, join(workspaceDirectory, "src/cli.js"));
    await execFileAsync("git", ["add", "src/cli.js"], { cwd: workspaceDirectory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "Link planner outside committed workspace"], { cwd: workspaceDirectory });
    const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
    expect(checks.find(({ name }) => name === "workspace:public-interface:invocation")).toMatchObject({ passed: false });
    expect(checks.find(({ name }) => name === "workspace:conservation-delivery:commit")).toMatchObject({ passed: true });
  });

  runtimeIt("rejects regular committed CLIs that execute uncommitted external code", async () => {
    for (const escape of ["dynamic-import", "child-process"] as const) {
      const { workspaceDirectory, receipt } = await fixture();
      const externalSolver = join(workspaceDirectory, "..", `${escape}-solver.mjs`);
      await writeFile(externalSolver, await readFile(join(import.meta.dirname, "fixtures/emergency-evacuation/exhaustive-solver.mjs"), "utf8"), "utf8");
      const source = escape === "dynamic-import"
        ? `await import(${JSON.stringify(`file://${externalSolver}`)});\n`
        : `import{spawnSync}from'node:child_process';const r=spawnSync(process.execPath,[${JSON.stringify(externalSolver)},process.argv[2]],{encoding:'utf8'});process.stdout.write(r.stdout);process.stderr.write(r.stderr);process.exitCode=r.status??1;\n`;
      await installSource(workspaceDirectory, source, `Install ${escape} external escape`);
      const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
      expect(checks.find(({ name }) => name === "workspace:public-interface:invocation"), escape).toMatchObject({ passed: false });
    }
  }, 30_000);

  runtimeIt("does not expose host environment secrets to the candidate CLI", async () => {
    const sentinel = "RELAYER_EVACUATION_HOST_SECRET_SENTINEL";
    const previous = process.env[sentinel];
    process.env[sentinel] = "must-not-cross-the-public-seam";
    try {
      const correct = await readFile(join(import.meta.dirname, "fixtures/emergency-evacuation/exhaustive-solver.mjs"), "utf8");
      const { workspaceDirectory, receipt } = await fixture();
      await installSource(workspaceDirectory, `if (process.env.${sentinel}) throw new Error("host secret leaked");\n${correct}`, "Install environment-isolation probe");
      const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
      expect(checks.every(({ passed }) => passed), JSON.stringify(checks)).toBe(true);
    } finally {
      if (previous === undefined) delete process.env[sentinel]; else process.env[sentinel] = previous;
    }
  }, 30_000);

  runtimeIt("keeps valid-scenario evidence when an invalid-input candidate deletes its input", async () => {
    const correct = await readFile(join(import.meta.dirname, "fixtures/emergency-evacuation/exhaustive-solver.mjs"), "utf8");
    const destructiveInvalid = correct
      .replace('import { readFile } from "node:fs/promises";', 'import { unlinkSync } from "node:fs";\nimport { readFile } from "node:fs/promises";')
      .replace('throw new Error("Duplicate entity ID")', '{ unlinkSync(process.argv[2]); throw new Error("Duplicate entity ID"); }');
    const { workspaceDirectory, receipt } = await fixture();
    await installSource(workspaceDirectory, destructiveInvalid, "Install invalid-input deletion mutant");
    const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
    expect(checks.find(({ name }) => name === "workspace:public-interface:invalid-input")).toMatchObject({ passed: true });
    expect(checks.find(({ name }) => name === "workspace:route-legality")).toMatchObject({ passed: true });
    expect(checks.find(({ name }) => name === "workspace:capacity-accessibility")).toMatchObject({ passed: true });
  }, 30_000);

  runtimeIt("contains malformed candidate structures without suppressing independent predicates", async () => {
    const malformedOutputs = [
      `import{readFileSync}from'node:fs';process.stdout.write(JSON.stringify({scenarioId:JSON.parse(readFileSync(process.argv[2])).id,plans:[null]})+'\\n');\n`,
      `import{readFileSync}from'node:fs';const s=JSON.parse(readFileSync(process.argv[2]));process.stdout.write(JSON.stringify({scenarioId:s.id,plans:[{id:'bad',assignments:[null],unassignedPickupIds:s.pickups.map(p=>p.id)}]})+'\\n');\n`,
    ];
    for (const [index, source] of malformedOutputs.entries()) {
      const { workspaceDirectory, receipt } = await fixture();
      await installSource(workspaceDirectory, source, `Install malformed output ${index}`);
      const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
      expect(checks).toHaveLength(13);
      for (const name of ["workspace:public-interface:invocation", "workspace:route-legality", "workspace:capacity-accessibility", "workspace:timing-dependencies", "workspace:conservation-delivery:conservation"]) {
        expect(checks.find((check) => check.name === name), `${index}:${name}`).toMatchObject({ passed: false });
      }
    }
  }, 30_000);

  runtimeIt("enforces the disclosed Node built-ins-only delivery boundary", async () => {
    for (const variant of ["declared", "malformed-bundled", "vendored"] as const) {
      const { workspaceDirectory, receipt } = await fixture();
      await installSolver(workspaceDirectory, "exhaustive-solver.mjs");
      if (variant === "vendored") {
        await mkdir(join(workspaceDirectory, "node_modules/lodash"), { recursive: true });
        await writeFile(join(workspaceDirectory, "node_modules/lodash/index.js"), "export default {};\n", "utf8");
        await execFileAsync("git", ["add", "-f", "node_modules/lodash/index.js"], { cwd: workspaceDirectory });
      } else {
        const manifest = JSON.parse(await readFile(join(workspaceDirectory, "package.json"), "utf8"));
        const mutation = variant === "declared" ? { dependencies: { lodash: "4.17.21" } } : { dependencies: "lodash@4.17.21", bundleDependencies: ["lodash"] };
        await writeFile(join(workspaceDirectory, "package.json"), `${JSON.stringify({ ...manifest, ...mutation }, null, 2)}\n`, "utf8");
        await execFileAsync("git", ["add", "package.json"], { cwd: workspaceDirectory });
      }
      await execFileAsync("git", ["commit", "--quiet", "-m", `Add forbidden ${variant} dependency`], { cwd: workspaceDirectory });
      const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
      expect(checks.find(({ name }) => name === "workspace:conservation-delivery:built-ins-only"), variant).toMatchObject({ passed: false });
    }
  }, 30_000);

  runtimeIt("rejects forbidden dependencies before launching any candidate CLI", async () => {
    const { workspaceDirectory, receipt } = await fixture();
    await installSolver(workspaceDirectory, "exhaustive-solver.mjs");
    const manifestPath = join(workspaceDirectory, "package.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    await writeFile(manifestPath, `${JSON.stringify({ ...manifest, dependencies: { lodash: "4.17.21" } }, null, 2)}\n`, "utf8");
    await execFileAsync("git", ["add", "package.json"], { cwd: workspaceDirectory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "Declare forbidden dependency"], { cwd: workspaceDirectory });

    let candidateLaunches = 0;
    const runCommand: CommandRunner = async (command, args, options) => {
      if (command === "/usr/bin/sandbox-exec") {
        candidateLaunches += 1;
        return { exitCode: 1, stdout: "", stderr: "candidate launch should have been blocked" };
      }
      try {
        const result = await execFileAsync(command, [...args], { cwd: options.cwd, env: options.env ? { ...options.env } : process.env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
        return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
      } catch (error) {
        const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
        return { exitCode: typeof failure.code === "number" ? failure.code : 1, stdout: failure.stdout ?? "", stderr: failure.stderr ?? failure.message };
      }
    };
    const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit, runCommand });
    expect(candidateLaunches).toBe(0);
    expect(checks).toHaveLength(13);
    expect(checks.find(({ name }) => name === "workspace:runtime:node-executable")).toMatchObject({ passed: true });
    expect(checks.find(({ name }) => name === "workspace:conservation-delivery:built-ins-only")).toMatchObject({ passed: false });
    expect(checks.find(({ name }) => name === "workspace:public-interface:invocation")).toMatchObject({ passed: false });
    expect(checks.find(({ name }) => name === "workspace:conservation-delivery:commit")).toMatchObject({ passed: true });
  }, 30_000);

  runtimeIt("rejects a hard-coded frozen answer on evaluator-owned scenario permutations", async () => {
    const { workspaceDirectory, receipt } = await fixture();
    await installSolver(workspaceDirectory, "exhaustive-solver.mjs");
    const frozen = (await execFileAsync(process.execPath, ["src/cli.js", "fixtures/harbor-fire.json"], { cwd: workspaceDirectory })).stdout.trim();
    const hardCoded = `process.stdout.write(${JSON.stringify(`${frozen}\n`)});\n`;
    await writeFile(join(workspaceDirectory, "src/cli.js"), hardCoded, "utf8");
    await execFileAsync("git", ["add", "src/cli.js"], { cwd: workspaceDirectory });
    await execFileAsync("git", ["commit", "--quiet", "-m", "Replace planner with frozen answer mutant"], { cwd: workspaceDirectory });
    const checks = await gradeEmergencyEvacuationWorkspace({ workspaceDirectory, baseRevision: receipt.seededCommit });
    expect(checks.find(({ name }) => name === "workspace:public-interface:invocation")).toMatchObject({ passed: false });
    expect(checks.find(({ name }) => name === "workspace:route-legality")).toMatchObject({ passed: false });
  }, 30_000);
});
