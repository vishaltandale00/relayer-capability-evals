export function createSceneHistoryController(initialScene) {
  return { getCurrentScene: () => structuredClone(initialScene), getVersions: () => [] };
}
export function importSceneHistory() { throw new Error("not implemented"); }
export function SceneHistoryPanel() { return null; }
