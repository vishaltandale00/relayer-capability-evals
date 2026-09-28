import {
  API_CONTRACT_SIMULATION_LABORATORY_GATE_CHECK_PATTERNS,
  ArtifactToolWorkbookInspector,
  EXCALIDRAW_UPSTREAM_COMMIT,
  HTTPCORE_UPSTREAM_COMMIT,
  JUPYTERLAB_UPSTREAM_COMMIT,
  NODE_REDIS_UPSTREAM_COMMIT,
  PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
  TOURNAMENT_VERIFIER_GATE_CHECKS,
  apiContractSimulationLaboratoryCase,
  emergencyEvacuationCase,
  evaluateEmergencyEvacuationMandatoryGate,
  excalidrawSceneHistoryCase,
  gradeApiContractSimulationLaboratoryWorkspace,
  gradeEmergencyEvacuationWorkspace,
  gradeExcalidrawSceneHistoryWorkspace,
  gradeHTTPCoreCancellationWorkspace,
  gradeJupyterLabExecutionBundlesWorkspace,
  gradeNodeRedisWorkspace,
  gradeProductionDeliveryPlannerWorkspace,
  gradeReservationCapacityWorkspace,
  gradeSaasOperatingModelWorkspace,
  gradeTournamentOperationsWorkspace,
  harnessCapabilityPilotV1Manifest,
  httpcoreCancellationCase,
  jupyterLabExecutionBundlesCase,
  materializeApiContractSimulationLaboratoryFixture,
  materializeEmergencyEvacuationFixture,
  materializeExcalidrawSceneHistoryFixture,
  materializeHTTPCoreCancellationFixture,
  materializeJupyterLabExecutionBundlesFixture,
  materializeNodeRedisProjectFixture,
  materializeProductionDeliveryPlannerFixture,
  materializeReservationCapacityFixture,
  materializeSaasOperatingModelFixture,
  materializeTournamentOperationsFixture,
  nodeRedisCommandQueueRaceCase,
  productionDeliveryPlannerCase,
  productionDeliveryPlannerRuntimeContract,
  reservationCapacityCase,
  reservationCapacityGateCheckPatterns,
  saasOperatingModelCase,
  spreadsheetRuntimeFromEnvironment,
  assertSpreadsheetRuntime,
  preflightApiContractSimulationLaboratoryEnvironment,
  preflightEmergencyEvacuationEnvironment,
  preflightSpreadsheetRuntime,
  tournamentOperationsCase,
  createProductionDeliveryPlannerRuntime,
} from "./dist/index.js";

const patterns = Object.freeze({
  ...TOURNAMENT_VERIFIER_GATE_CHECKS,
  ...API_CONTRACT_SIMULATION_LABORATORY_GATE_CHECK_PATTERNS,
  "queue-cleanup": ["fault-injection-observed", "failed-command-rejected-once", "queue-clean-before-reconnect"],
  "reconnect-integrity": ["reconnect-reply-order", "offline-queue-replayed-in-order", "reconnect-queue-drained", "single-failure-callbacks-settle"],
  "repeated-failure-safety": ["repeated-faults-observed", "fault-command-matrix-observed", "repeated-failures-rejected-independently", "repeated-reconnects-start-clean", "ordered-replies-after-recovery", "no-command-reply-misassociation", "callbacks-settle-without-hang"],
  "reply-mode-regression": ["client-reply-modes-preserved"],
  "node-redis-scoped-clean-commit": ["candidate-regression-passes", "focused-source-and-tests", "dependency-safe-scope", "meaningful-commit", "implementation-clean"],
  "cancellation-recovery": ["deterministic-cancellation", "connection-slot-release", "subsequent-request-success", "repeated-cancellation"],
  "resource-cleanup": ["httpcore-cleanup"],
  "focused-regression-safety": ["httpcore-regression-safety"],
  "committed-delivery": ["httpcore-meaningful-commit", "httpcore-clean"],
  "scene-history-behavior": ["scene-history-public-ui", "scene-history-named-immutable-versions", "scene-history-historical-branching", "scene-history-deterministic-merge", "scene-history-conflict-taxonomy", "scene-history-relationship-integrity", "scene-history-groups-and-assets", "scene-history-undo-boundary", "scene-history-native-assets-appstate", "scene-history-export-boundary", "scene-history-historical-compatibility"],
  "scene-history-regression": ["scene-history-qualification-authority", "scene-history-build", "scene-history-upstream-tests"],
  "scene-history-delivery": ["scene-history-commit", "scene-history-clean"],
  "bundle-contract": ["bundle-public-api", "bundle-environment-identity", "bundle-ordered-execution-evidence", "bundle-output-preservation", "bundle-referenced-file-integrity", "bundle-bundle-integrity", "bundle-read-only-import", "bundle-rerun-comparison", "bundle-partial-execution"],
  "integrity-failures": ["bundle-missing-inputs", "bundle-tamper-detection"],
  "visible-status": ["bundle-ui-status"],
  "upstream-regression": ["implementation-build", "focused-upstream-tests", "sealed-public-export"],
  "pristine-verification": ["pristine-verification-integrity"],
  "committed-clean-workspace": ["meaningful-commit", "implementation-clean"],
  "source-coverage": ["source-coverage:subscriptions-rows", "source-coverage:invoices-rows", "source-coverage:payments-rows", "source-coverage:payroll-rows", "source-coverage:expenses-rows", "source-coverage:cash-rows"],
  "historical-reconciliation": ["historical-reconciliation:keys", "historical-reconciliation:independent-values"],
  "forecast-scenarios": ["forecast-scenarios:keys", "forecast-scenarios:materially-different", "forecast-scenarios:distinct-drivers", "forecast-scenarios:independent-values"],
  "cash-runway": ["cash-runway:keys", "cash-runway:independent-values"],
  "formula-lineage": ["formula-lineage:required-outputs", "formula-lineage:unique-keys", "formula-lineage:cell-references", "formula-lineage:no-external-links", "formula-lineage:no-external-package-parts", "formula-lineage:no-dynamic-external-functions", "formula-lineage:no-formula-errors", "formula-lineage:dashboard-values", "formula-lineage:visible-checks"],
  "workbook-rendering": ["workbook-rendering:all-sheets", "workbook-rendering:dashboard-chart", "workbook-rendering:dashboard-chart-series", "workbook-rendering:dashboard-chart-binding"],
  "changed-input-response": ["changed-input-response:invoice"],
  "scoped-delivery": ["required-delivery-files", "delivery-commit", "delivery-clean"],
  "workbook-integrity": ["runtime-identity", "workbook-parse", "source-coverage", "workbook-horizon", "scenario-controls", "formula-lineage", "workbook-rendering"],
  "planning-integrity": ["complete-order-coverage", "order-conservation", "component-dependencies", "finished-goods-conservation", "weekly-capacity", "purchase-lead-times", "fulfillment-dates", "infeasible-exceptions"],
  "financial-integrity": ["cost-arithmetic", "cross-sheet-consistency"],
  "responsive-model": ["changed-input-order-quantity", "changed-input-capacity-hours", "changed-input-supplier-lead-time", "changed-scenario-demand-multiplier", "changed-scenario-capacity-multiplier", "changed-scenario-supplier-lead-time-adjustment", "changed-scenario-expedite-enabled"],
  "committed-workbook": ["required-workbook", "delivery-commit", "delivery-clean"],
});

function gateEvaluation(gate, checks) {
  const gateId = typeof gate === "string" ? gate : gate?.id;
  if (typeof gateId !== "string") return { complete: false, passed: false, matched: [] };
  const emergency = evaluateEmergencyEvacuationMandatoryGate(gateId, checks);
  if (emergency) return emergency;
  const required = gateId.startsWith("reservation-") ? reservationCapacityGateCheckPatterns[gateId] : patterns[gateId];
  if (!Array.isArray(required)) return { complete: false, passed: false, matched: [] };
  const matched = checks.filter((check) => required.some((name) => check.name.includes(name)));
  const complete = required.every((name) => matched.some((check) => check.name.includes(name)));
  return { complete, passed: complete && matched.every((check) => check.passed), matched };
}

function definition(boundCase) {
  return Object.freeze({
    ...structuredClone(boundCase.definition),
    caseSnapshot: structuredClone(boundCase.catalogSnapshot),
    caseSnapshotDigest: boundCase.snapshotDigest,
  });
}

export function plannerRuntimeConfig(environment = process.env) {
  const nodeExecutable = environment.RELAYER_SPREADSHEET_NODE;
  const nodeModulesPath = environment.RELAYER_SPREADSHEET_NODE_MODULES;
  if (!nodeExecutable || !nodeModulesPath) throw new Error("Planner evaluation requires RELAYER_SPREADSHEET_NODE and RELAYER_SPREADSHEET_NODE_MODULES.");
  return Object.freeze({
    nodeExecutable,
    nodeModulesPath,
    environmentDigest: PRODUCTION_DELIVERY_PLANNER_ENVIRONMENT_DIGEST,
    nodeVersion: productionDeliveryPlannerRuntimeContract.node,
    artifactToolVersion: productionDeliveryPlannerRuntimeContract.artifactTool,
    nodeExecutableDigest: productionDeliveryPlannerRuntimeContract.nodeExecutableDigest,
    artifactToolEntrypointDigest: productionDeliveryPlannerRuntimeContract.artifactToolEntrypointDigest,
    artifactToolContentDigest: productionDeliveryPlannerRuntimeContract.artifactToolContentDigest,
  });
}

function plannerRuntime(environment = process.env) {
  return createProductionDeliveryPlannerRuntime(plannerRuntimeConfig(environment));
}

function registration(boundCase, materialize, grade, availability = { available: true, unavailableReason: null }) {
  return Object.freeze({
    boundCase,
    definition: definition(boundCase),
    ...availability,
    materialize,
    grade,
    evaluateMandatoryGate: gateEvaluation,
  });
}

export function createSaasRegistration(runtime, availability, dependencies = {}) {
  const materialize = dependencies.materialize ?? materializeSaasOperatingModelFixture;
  const grade = dependencies.grade ?? gradeSaasOperatingModelWorkspace;
  const Inspector = dependencies.Inspector ?? ArtifactToolWorkbookInspector;
  return registration(saasOperatingModelCase,
    (ctx) => materialize({ workspaceDirectory: ctx.workspaceDirectory, platform: ctx.platform, runtime }),
    (ctx) => grade({ workspaceDirectory: ctx.workspaceDirectory, baseRevision: ctx.fixture.seededCommit, inspector: new Inspector(runtime) }),
    availability);
}

export async function createEvalCatalog(dependencies = {}) {
  const environment = dependencies.environment ?? process.env;
  const assertSaasRuntime = dependencies.assertSpreadsheetRuntime ?? assertSpreadsheetRuntime;
  const preflightPlannerRuntime = dependencies.preflightSpreadsheetRuntime ?? preflightSpreadsheetRuntime;
  const platformAvailability = process.platform === "darwin"
    ? { available: true, unavailableReason: null }
    : { available: false, unavailableReason: `Case requires darwin; current platform is ${process.platform}.` };
  const apiPreflight = platformAvailability.available
    ? await preflightApiContractSimulationLaboratoryEnvironment()
    : platformAvailability;
  const emergencyNodeExecutable = environment.RELAYER_EVAL_NODE?.trim() || process.execPath;
  const emergencyPreflight = platformAvailability.available
    ? await preflightEmergencyEvacuationEnvironment({ nodeExecutable: emergencyNodeExecutable, cwd: process.cwd() })
    : platformAvailability;
  let spreadsheetRuntime = null;
  let spreadsheetPreflight = platformAvailability;
  let plannerAvailability = platformAvailability;
  if (platformAvailability.available) {
    try {
      spreadsheetRuntime = spreadsheetRuntimeFromEnvironment(environment);
      await assertSaasRuntime(spreadsheetRuntime);
      spreadsheetPreflight = { available: true, unavailableReason: null };
    } catch (error) {
      spreadsheetPreflight = { available: false, unavailableReason: error instanceof Error ? error.message : String(error) };
    }
    try {
      const result = await preflightPlannerRuntime(plannerRuntimeConfig(environment));
      plannerAvailability = result.available
        ? { available: true, unavailableReason: null }
        : { available: false, unavailableReason: result.reason ?? "Planner runtime preflight failed." };
    } catch (error) {
      plannerAvailability = { available: false, unavailableReason: error instanceof Error ? error.message : String(error) };
    }
  }
  const cases = [
    registration(reservationCapacityCase,
      (ctx) => materializeReservationCapacityFixture({ caseId: ctx.caseId, workspaceDirectory: ctx.workspaceDirectory, platform: ctx.platform }),
      (ctx) => gradeReservationCapacityWorkspace({ caseId: ctx.caseId, workspaceDirectory: ctx.workspaceDirectory, baseRevision: ctx.fixture.seededCommit }), platformAvailability),
    registration(tournamentOperationsCase,
      (ctx) => materializeTournamentOperationsFixture({ caseId: ctx.caseId, workspaceDirectory: ctx.workspaceDirectory, platform: ctx.platform }),
      (ctx) => gradeTournamentOperationsWorkspace({ caseId: ctx.caseId, workspaceDirectory: ctx.workspaceDirectory, baseRevision: ctx.fixture.seededCommit }), platformAvailability),
    registration(apiContractSimulationLaboratoryCase,
      (ctx) => materializeApiContractSimulationLaboratoryFixture({ workspaceDirectory: ctx.workspaceDirectory, platform: ctx.platform }),
      (ctx) => gradeApiContractSimulationLaboratoryWorkspace({ workspaceDirectory: ctx.workspaceDirectory, baseRevision: ctx.fixture.seededCommit }), { available: apiPreflight.available, unavailableReason: apiPreflight.available ? null : (apiPreflight.reason ?? "API contract laboratory preflight failed.") }),
    registration(emergencyEvacuationCase,
      (ctx) => materializeEmergencyEvacuationFixture({ workspaceDirectory: ctx.workspaceDirectory, platform: ctx.platform }),
      (ctx) => gradeEmergencyEvacuationWorkspace({ workspaceDirectory: ctx.workspaceDirectory, baseRevision: ctx.fixture.seededCommit, nodeExecutable: emergencyNodeExecutable }), { available: emergencyPreflight.available, unavailableReason: emergencyPreflight.available ? null : (emergencyPreflight.reason ?? "Emergency evacuation runtime preflight failed.") }),
    registration(httpcoreCancellationCase,
      (ctx) => materializeHTTPCoreCancellationFixture({ cacheDirectory: ctx.cacheDirectory ?? `${ctx.workspaceDirectory}-cache-${HTTPCORE_UPSTREAM_COMMIT}`, workspaceDirectory: ctx.workspaceDirectory, environmentDirectory: `${ctx.workspaceDirectory}-environment`, platform: ctx.platform }),
      (ctx) => gradeHTTPCoreCancellationWorkspace({ workspaceDirectory: ctx.workspaceDirectory, pythonExecutable: ctx.fixture.pythonExecutable }), platformAvailability),
    registration(nodeRedisCommandQueueRaceCase,
      (ctx) => materializeNodeRedisProjectFixture({ cacheDirectory: ctx.cacheDirectory ?? `${ctx.workspaceDirectory}-cache-${NODE_REDIS_UPSTREAM_COMMIT}`, workspaceDirectory: ctx.workspaceDirectory }),
      (ctx) => gradeNodeRedisWorkspace({ workspaceDirectory: ctx.workspaceDirectory }), platformAvailability),
    registration(excalidrawSceneHistoryCase,
      (ctx) => materializeExcalidrawSceneHistoryFixture({ cacheDirectory: ctx.cacheDirectory ?? `${ctx.workspaceDirectory}-cache-${EXCALIDRAW_UPSTREAM_COMMIT}`, workspaceDirectory: ctx.workspaceDirectory }),
      (ctx) => gradeExcalidrawSceneHistoryWorkspace({ workspaceDirectory: ctx.workspaceDirectory }), platformAvailability),
    registration(jupyterLabExecutionBundlesCase,
      (ctx) => materializeJupyterLabExecutionBundlesFixture({ cacheDirectory: ctx.cacheDirectory ?? `${ctx.workspaceDirectory}-cache-${JUPYTERLAB_UPSTREAM_COMMIT}`, workspaceDirectory: ctx.workspaceDirectory, platform: ctx.platform }),
      (ctx) => gradeJupyterLabExecutionBundlesWorkspace({ workspaceDirectory: ctx.workspaceDirectory }), platformAvailability),
    createSaasRegistration(spreadsheetRuntime, spreadsheetPreflight),
    registration(productionDeliveryPlannerCase,
      (ctx) => materializeProductionDeliveryPlannerFixture({ workspaceDirectory: ctx.workspaceDirectory, platform: ctx.platform }),
      (ctx) => gradeProductionDeliveryPlannerWorkspace({ workspaceDirectory: ctx.workspaceDirectory, baseRevision: ctx.fixture.seededCommit, runtime: plannerRuntime(environment) }), plannerAvailability),
  ];
  return Object.freeze({ schemaVersion: 1, cases: Object.freeze(cases), suites: Object.freeze([harnessCapabilityPilotV1Manifest]) });
}
