import type { EvalCatalogV1 } from "@relayer/eval-runner";
import type { createEvalCatalog as createCapabilityCatalog } from "./catalog.mjs";
export function createEvalCatalog(options?: Parameters<typeof createCapabilityCatalog>[0]): Promise<EvalCatalogV1>;
