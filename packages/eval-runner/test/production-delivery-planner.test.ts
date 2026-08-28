import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, symlink } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PRODUCTION_DELIVERY_PLANNER_CASE_ID,
  PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  gradeProductionDeliveryPlannerWorkspace,
  materializeProductionDeliveryPlannerFixture,
  productionDeliveryPlannerCase,
  productionDeliveryPlannerCaseIds,
  productionDeliveryPlannerCases,
  productionDeliveryPlannerRuntimeContract,
} from "../src/project-cases/production-delivery-planner.js";
import type { EvalCheck } from "../src/runtime-basic.js";
import type { SpreadsheetRuntimeConfig } from "../src/project-cases/spreadsheet-runtime.js";

const execFileAsync = promisify(execFile);
const builderSource = resolve(import.meta.dirname, "fixtures/production-delivery-planner-workbook.mjs");
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const admissionManifestPath = join(repositoryRoot, "eval-cases/production-delivery-planner/admission-manifest.json");
const nodeExecutable = process.env.RELAYER_SPREADSHEET_NODE;
const nodeModulesPath = process.env.RELAYER_SPREADSHEET_NODE_MODULES;
const runtimeAvailable = Boolean(nodeExecutable && nodeModulesPath);
const runtime: SpreadsheetRuntimeConfig | null = runtimeAvailable ? {
  nodeExecutable: nodeExecutable!,
  nodeModulesPath: nodeModulesPath!,
  environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  nodeVersion: productionDeliveryPlannerRuntimeContract.node,
  artifactToolVersion: productionDeliveryPlannerRuntimeContract.artifactTool,
  nodeExecutableDigest: productionDeliveryPlannerRuntimeContract.nodeExecutableDigest,
  artifactToolEntrypointDigest: productionDeliveryPlannerRuntimeContract.artifactToolEntrypointDigest,
  timeoutMs: 120_000,
} : null;

type WorkbookVariant =
  | "green-primary"
  | "green-alternate"
  | "mutant-hardcoded"
  | "mutant-capacity"
  | "mutant-components"
  | "mutant-inventory"
  | "mutant-missing-order"
  | "mutant-late-delivery"
  | "mutant-receipt"
  | "mutant-cost"
  | "mutant-stale-dashboard"
  | "mutant-dashboard";

interface CandidateWorkspace {
  readonly root: string;
  readonly workspaceDirectory: string;
}

const workspaces: CandidateWorkspace[] = [];
const gradeReceipts = new Map<WorkbookVariant, readonly EvalCheck[]>();

describe("production and delivery planner case contract", () => {
  it("binds the admission manifest to the immutable case, runtime, and portfolio sources", async () => {
    const manifest = JSON.parse(await readFile(admissionManifestPath, "utf8"));
    const fileDigest = async (relativePath: string) => `sha256:${createHash("sha256").update(await readFile(join(repositoryRoot, relativePath))).digest("hex")}`;
    expect(manifest).toMatchObject({
      caseId: PRODUCTION_DELIVERY_PLANNER_CASE_ID,
      caseSnapshotDigest: productionDeliveryPlannerCase.snapshotDigest,
      fixtureContentDigest: productionDeliveryPlannerCase.snapshot.artifacts.workspace.contentDigest,
      environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
      verifierDigest: productionDeliveryPlannerCase.snapshot.artifacts.verifier.contentDigest,
      taskDigest: productionDeliveryPlannerCase.snapshot.artifacts.task.contentDigest,
      greens: ["green-primary", "green-alternate"],
    });
    expect(manifest.sourceDigests).toEqual({
      case: await fileDigest("packages/eval-runner/src/project-cases/production-delivery-planner.ts"),
      runtime: await fileDigest("packages/eval-runner/src/project-cases/spreadsheet-runtime.ts"),
      portfolioBuilder: await fileDigest("packages/eval-runner/test/fixtures/production-delivery-planner-workbook.mjs"),
    });
  });

  it("publishes one candidate case with a sealed verifier and no private catalog paths", () => {
    expect(PRODUCTION_DELIVERY_PLANNER_CASE_ID).toBe("capability.spreadsheet.production-delivery-planner");
    expect([...productionDeliveryPlannerCaseIds]).toEqual([PRODUCTION_DELIVERY_PLANNER_CASE_ID]);
    expect(productionDeliveryPlannerCases).toEqual([productionDeliveryPlannerCase]);
    expect(productionDeliveryPlannerCase.snapshot).toMatchObject({
      id: PRODUCTION_DELIVERY_PLANNER_CASE_ID,
      category: "work",
      taskType: "spreadsheet-model",
      authoringStatus: "candidate",
      artifacts: {
        task: { kind: "visible-task" },
        workspace: { kind: "frozen-workspace" },
        reference: { kind: "sealed-reference", format: "semantic-contract" },
        verifier: { kind: "sealed-verifier" },
      },
    });
    expect(productionDeliveryPlannerCase.definition.threads).toHaveLength(1);
    expect(productionDeliveryPlannerCase.definition.threads[0]).toMatchObject({
      mutationPolicy: "writable",
      workspaceGrade: "autonomous-implementation",
    });
    const task = productionDeliveryPlannerCase.snapshot.artifacts.task.text;
    for (const promise of [
      "twelve-week", "order", "component", "inventory", "supplier", "capacity", "shipping",
      "scenario", "purchase", "expedite", "exception", "cost", "dashboard", ".xlsx",
    ]) expect(task.toLowerCase()).toContain(promise);
    expect(JSON.stringify(productionDeliveryPlannerCase.catalogSnapshot)).not.toContain("sealedPath");
    expect(productionDeliveryPlannerCase.snapshotDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});

describe.skipIf(!runtimeAvailable)("production and delivery planner verifier admission portfolio", () => {
  const candidates = new Map<WorkbookVariant, CandidateWorkspace>();

  beforeAll(async () => {
    if (!runtime) return;
    for (const variant of [
      "green-primary",
      "green-alternate",
      "mutant-hardcoded",
      "mutant-capacity",
      "mutant-components",
      "mutant-inventory",
      "mutant-missing-order",
      "mutant-late-delivery",
      "mutant-receipt",
      "mutant-cost",
      "mutant-stale-dashboard",
      "mutant-dashboard",
    ] as const) candidates.set(variant, await createCandidate(variant));
  }, 180_000);

  afterAll(async () => {
    await Promise.all(workspaces.splice(0).map(({ root }) => rm(root, { recursive: true, force: true })));
  });

  it("keeps the untouched deterministic fixture red for the intended missing-delivery reasons", async () => {
    if (!runtime) return;
    const root = await mkdtemp(join(tmpdir(), "planner-red-"));
    const workspaceDirectory = join(root, "workspace");
    workspaces.push({ root, workspaceDirectory });
    await materializeProductionDeliveryPlannerFixture({ workspaceDirectory, platform: "darwin" });

    const checks = await gradeProductionDeliveryPlannerWorkspace({ workspaceDirectory, runtime });

    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(checkNamed(checks, "workspace:workbook-parse").passed).toBe(false);
    expect(checkNamed(checks, "workspace:workbook-rendering").passed).toBe(false);
    expect(checks.some(({ passed }) => passed)).toBe(true);
  });

  it("admits two materially different formula-driven workbooks without exact sheet coordinates or row order", async () => {
    if (!runtime) return;
    const primary = await grade("green-primary", runtime, candidates);
    const alternate = await grade("green-alternate", runtime, candidates);

    expect(primary.filter(({ passed }) => !passed), JSON.stringify(primary.filter(({ passed }) => !passed), null, 2)).toEqual([]);
    expect(alternate.filter(({ passed }) => !passed), JSON.stringify(alternate.filter(({ passed }) => !passed), null, 2)).toEqual([]);
    expect(primary.filter(({ name }) => name.startsWith("workspace:changed-input-")).every(({ passed }) => passed)).toBe(true);
    expect(alternate.filter(({ name }) => name.startsWith("workspace:changed-input-")).every(({ passed }) => passed)).toBe(true);
    expect(checkNamed(primary, "workspace:workbook-rendering").detail).toMatch(/png|render|sheet/i);
    expect(checkNamed(alternate, "workspace:workbook-rendering").detail).toMatch(/png|render|sheet/i);
  }, 180_000);

  it.each([
    ["mutant-hardcoded", "workspace:changed-input-order-quantity"],
    ["mutant-capacity", "workspace:weekly-capacity"],
    ["mutant-components", "workspace:component-dependencies"],
    ["mutant-inventory", "workspace:component-dependencies"],
    ["mutant-missing-order", "workspace:complete-order-coverage"],
    ["mutant-late-delivery", "workspace:fulfillment-dates"],
    ["mutant-receipt", "workspace:purchase-lead-times"],
    ["mutant-cost", "workspace:cost-arithmetic"],
    ["mutant-stale-dashboard", "workspace:cross-sheet-consistency"],
    ["mutant-dashboard", "workspace:workbook-rendering"],
  ] as const)("rejects %s through the independent %s predicate", async (variant, predicate) => {
    if (!runtime) return;
    const checks = await grade(variant, runtime, candidates);
    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(checkNamed(checks, predicate).passed).toBe(false);
    expect(checks.some(({ passed }) => passed)).toBe(true);
  }, 180_000);

  it("records independent predicates even when cost arithmetic fails", async () => {
    if (!runtime) return;
    const checks = await grade("mutant-cost", runtime, candidates);
    expect(checkNamed(checks, "workspace:cost-arithmetic").passed).toBe(false);
    expect(checkNamed(checks, "workspace:cross-sheet-consistency").passed).toBe(true);
    expect(checkNamed(checks, "workspace:complete-order-coverage").passed).toBe(true);
    expect(checkNamed(checks, "workspace:weekly-capacity").passed).toBe(true);
    expect(checkNamed(checks, "workspace:component-dependencies").passed).toBe(true);
  }, 180_000);
});

async function grade(
  variant: WorkbookVariant,
  configuredRuntime: SpreadsheetRuntimeConfig,
  candidates: ReadonlyMap<WorkbookVariant, CandidateWorkspace>,
): Promise<readonly EvalCheck[]> {
  const candidate = candidates.get(variant);
  if (!candidate) throw new Error(`Candidate was not created: ${variant}`);
  const prior = gradeReceipts.get(variant);
  if (prior) return prior;
  const checks = await gradeProductionDeliveryPlannerWorkspace({
    workspaceDirectory: candidate.workspaceDirectory,
    runtime: configuredRuntime,
  });
  gradeReceipts.set(variant, checks);
  return checks;
}

function checkNamed(checks: readonly EvalCheck[], expectedName: string): EvalCheck {
  const matching = checks.filter(({ name }) => name === expectedName);
  expect(matching, `Expected exactly one ${expectedName}; received ${checks.map(({ name }) => name).join(", ")}`).toHaveLength(1);
  return matching[0]!;
}

async function createCandidate(variant: WorkbookVariant): Promise<CandidateWorkspace> {
  if (!runtime) throw new Error("Spreadsheet runtime is unavailable.");
  const root = await mkdtemp(join(tmpdir(), `planner-${variant}-`));
  const workspaceDirectory = join(root, "workspace");
  const runtimeDirectory = join(root, "artifact-runtime");
  const builderPath = join(runtimeDirectory, "builder.mjs");
  const workbookPath = join(workspaceDirectory, "production-delivery-plan.xlsx");
  workspaces.push({ root, workspaceDirectory });
  await materializeProductionDeliveryPlannerFixture({ workspaceDirectory, platform: "darwin" });
  await mkdir(runtimeDirectory, { recursive: true });
  await cp(builderSource, builderPath);
  await symlink(runtime.nodeModulesPath, join(runtimeDirectory, "node_modules"), "dir");
  await execFileAsync(runtime.nodeExecutable, [builderPath, workbookPath, variant], {
    cwd: runtimeDirectory,
    env: {
      TMPDIR: runtimeDirectory,
      TZ: "UTC",
      LANG: "C",
      LC_ALL: "C",
      PATH: dirname(runtime.nodeExecutable),
    },
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  await rm(`${workbookPath}.inspect.ndjson`, { force: true });
  await git(workspaceDirectory, ["add", "--", "production-delivery-plan.xlsx"]);
  await git(workspaceDirectory, ["commit", "--quiet", "-m", `Deliver planner workbook (${variant})`], {
    GIT_AUTHOR_NAME: "Relayer Eval Candidate",
    GIT_AUTHOR_EMAIL: "eval-candidate@relayer.local",
    GIT_AUTHOR_DATE: "2026-08-28T12:00:00Z",
    GIT_COMMITTER_NAME: "Relayer Eval Candidate",
    GIT_COMMITTER_EMAIL: "eval-candidate@relayer.local",
    GIT_COMMITTER_DATE: "2026-08-28T12:00:00Z",
  });
  return { root, workspaceDirectory };
}

async function git(
  cwd: string,
  args: readonly string[],
  environment: Readonly<Record<string, string>> = {},
): Promise<void> {
  await execFileAsync("git", [...args], {
    cwd,
    env: { ...process.env, ...environment },
    encoding: "utf8",
    timeout: 30_000,
  });
}
