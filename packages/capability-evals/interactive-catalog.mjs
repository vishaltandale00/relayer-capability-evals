import { createEvalCatalog as createCapabilityCatalog } from "./catalog.mjs";
import { interactiveEverydayRegistrations, interactiveHumanExplorationManifest } from "./dist/interactive-pilot.js";

// Compose the canonical registrations without changing the sealed coding adapter.
export async function createEvalCatalog(options) {
  const catalog = await createCapabilityCatalog(options);
  return Object.freeze({ ...catalog,
    cases: Object.freeze([...catalog.cases, ...interactiveEverydayRegistrations]),
    suites: Object.freeze([...catalog.suites, interactiveHumanExplorationManifest]),
  });
}
