import { createSceneHistoryController as createGood, importSceneHistory as importGood, SceneHistoryPanel } from "./green-functional.mjs";

export function mutant(kind) {
  return {
    createSceneHistoryController(initial) {
      const controller = createGood(initial);
      const broken = { ...controller };
      if (kind === "branch-overwrite") {
        const save = controller.saveVersion;
        broken.saveVersion = (request) => ({ ...save(request), parentIds: [] });
        broken.listVersions = () => controller.listVersions().map((version) => ({ ...version, parentIds: [] }));
      }
      if (kind === "silent-lww") {
        const merge = controller.mergeVersions;
        broken.mergeVersions = (request) => {
          const result = merge(request);
          if (result.status !== "conflicts") return result;
          return controller.resolveMerge(result.mergeId, Object.fromEntries(result.conflicts.map(({ id }) => [id, "right"])));
        };
      }
      if (kind === "nondeterminism") {
        const merge = controller.mergeVersions;
        broken.mergeVersions = (request) => merge({ ...request, name: `${request.name}:${request.versionIds[0]}` });
      }
      if (kind === "common-ancestor") {
        const merge = controller.mergeVersions;
        broken.mergeVersions = (request) => {
          try { return merge(request); } catch {
            const root = controller.listVersions().find((version) => (version.parentIds ?? []).length === 0);
            return merge({ ...request, baseVersionId: root.id });
          }
        };
      }
      if (kind === "ordering") {
        const merge = controller.mergeVersions;
        broken.mergeVersions = (request) => {
          const result = merge(request);
          if (result.scene?.elements) result.scene.elements.reverse();
          return result;
        };
      }
      if (["bindings", "groups", "assets", "frame-container"].includes(kind)) {
        const damage = (scene) => kind === "bindings"
          ? { ...scene, elements: scene.elements.map(({ startBinding, endBinding, boundElements, ...element }) => element) }
          : kind === "groups"
            ? { ...scene, elements: scene.elements.map(({ groupIds, ...element }) => element) }
            : kind === "frame-container"
              ? { ...scene, elements: scene.elements.map(({ frameId, containerId, ...element }) => element) }
              : { ...scene, files: {} };
        broken.getCurrentScene = () => damage(controller.getCurrentScene());
        const checkout = controller.checkout;
        broken.checkout = (id) => damage(checkout(id));
      }
      if (kind === "undo") broken.undo = () => false;
      if (kind === "early-resolution") broken.resolveMerge = () => ({ status: "merged", version: { id: "forged-merge", parentIds: [] }, scene: controller.getCurrentScene() });
      if (kind === "export") broken.exportHistory = () => JSON.stringify(controller.getCurrentScene());
      return broken;
    },
    importSceneHistory(value) {
      if (kind === "compat") throw new Error("legacy unsupported");
      if (kind === "history-loss") {
        const parsed = typeof value === "string" ? JSON.parse(value) : value;
        if (parsed?.type === "excalidraw-scene-history") return createGood(parsed.snapshots[parsed.currentVersionId]);
      }
      return importGood(value);
    },
    SceneHistoryPanel: kind === "ui-accessibility" ? () => null : SceneHistoryPanel,
  };
}
