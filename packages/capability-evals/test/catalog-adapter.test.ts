import { describe, expect, it } from "vitest";

import { createEvalCatalog, createSaasRegistration } from "../catalog.mjs";

describe("external capability catalog adapter", () => {
  it("registers the exact ordered ten-case suite with private bound snapshots", async () => {
    const catalog = await createEvalCatalog();
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.cases.map(({ definition }) => definition.id)).toEqual([
      "capability.greenfield.reservation-capacity",
      "capability.greenfield.tournament-operations",
      "capability.greenfield.api-contract-simulation-laboratory",
      "capability.greenfield.emergency-evacuation-route-planner",
      "autonomous.httpcore.cancellation-poisoned-pool",
      "autonomous.node-redis.command-queue-race",
      "autonomous.excalidraw.scene-history",
      "jupyterlab.reproducible-execution-bundles",
      "capability.spreadsheet.saas-operating-model",
      "capability.spreadsheet.production-delivery-planner",
    ]);
    expect(catalog.suites).toHaveLength(1);
    for (const registration of catalog.cases) {
      expect(typeof registration.available).toBe("boolean");
      expect(registration.available ? registration.unavailableReason : typeof registration.unavailableReason)
        .toBe(registration.available ? null : "string");
      expect(registration.boundCase.snapshotDigest).toBe(registration.definition.caseSnapshotDigest);
      expect(registration.definition.caseSnapshot.artifacts.reference).not.toHaveProperty("sealedPath");
      expect(registration.definition.caseSnapshot.artifacts.verifier).not.toHaveProperty("sealedPath");
      expect(typeof registration.materialize).toBe("function");
      expect(typeof registration.grade).toBe("function");
      expect(registration.evaluateMandatoryGate("unknown-gate", [])).toEqual({ complete: false, passed: false, matched: [] });
    }
  });

  it("keeps mandatory gate judgment inside the case catalog", async () => {
    const catalog = await createEvalCatalog();
    const nodeRedis = catalog.cases.find(({ definition }) => definition.id === "autonomous.node-redis.command-queue-race");
    expect(nodeRedis).toBeDefined();
    const checks = [
      { name: "workspace:fault-injection-observed", passed: true, detail: "observed" },
      { name: "workspace:failed-command-rejected-once", passed: true, detail: "rejected" },
      { name: "workspace:queue-clean-before-reconnect", passed: true, detail: "clean" },
    ];
    expect(nodeRedis?.evaluateMandatoryGate("queue-cleanup", checks)).toMatchObject({ complete: true, passed: true });
  });

  it("wires the configured spreadsheet runtime through SaaS materialization and inspection", async () => {
    const runtime = { nodeExecutable: "/runtime/node", nodeModulesPath: "/runtime/node_modules" };
    const observed: unknown[] = [];
    class Inspector {
      constructor(received: unknown) { observed.push({ inspectorRuntime: received }); }
    }
    const entry = createSaasRegistration(runtime, { available: true, unavailableReason: null }, {
      materialize: async (options: unknown) => { observed.push({ materialize: options }); return { seededCommit: "seed" }; },
      grade: async (options: unknown) => { observed.push({ grade: options }); return []; },
      Inspector,
    });
    await entry.materialize({ caseId: entry.definition.id, workspaceDirectory: "/workspace", cacheDirectory: "/cache", platform: "darwin" });
    await entry.grade({ caseId: entry.definition.id, workspaceDirectory: "/workspace", fixture: { seededCommit: "seed" }, threadDefinition: {} });
    expect(observed).toEqual([
      { materialize: { workspaceDirectory: "/workspace", platform: "darwin", runtime } },
      { inspectorRuntime: runtime },
      { grade: { workspaceDirectory: "/workspace", baseRevision: "seed", inspector: expect.any(Inspector) } },
    ]);
  });

  it("preflights SaaS paths and the Planner identity config through their distinct contracts", async () => {
    const seen: unknown[] = [];
    const environment = {
      RELAYER_SPREADSHEET_NODE: "/runtime/node",
      RELAYER_SPREADSHEET_NODE_MODULES: "/runtime/node_modules",
    };
    const catalog = await createEvalCatalog({
      environment,
      assertSpreadsheetRuntime: async (runtime: unknown) => { seen.push({ saas: runtime }); },
      preflightSpreadsheetRuntime: async (runtime: any) => {
        expect(runtime).toMatchObject({
          nodeExecutable: "/runtime/node",
          nodeModulesPath: "/runtime/node_modules",
          environmentDigest: expect.stringMatching(/^sha256:/),
        });
        seen.push({ planner: runtime });
        return { available: true } as const;
      },
    });
    expect(seen).toEqual([
      { saas: { nodeExecutable: "/runtime/node", nodeModulesDirectory: "/runtime/node_modules" } },
      { planner: expect.objectContaining({ nodeExecutable: "/runtime/node", nodeModulesPath: "/runtime/node_modules" }) },
    ]);
    expect(catalog.cases.slice(-2).map(({ available }) => available)).toEqual([true, true]);
  });
});
