import { createHash } from "node:crypto";

const clone = (value) => structuredClone(value);
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};
const equal = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const hash = (value) => createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex").slice(0, 20);
const cleanElement = (element) => Object.fromEntries(Object.entries(element).filter(([key]) => !["version", "versionNonce", "updated"].includes(key)));
const normalizeScene = (scene) => ({
  type: scene.type ?? "excalidraw",
  version: scene.version ?? 2,
  elements: clone(scene.elements ?? []).sort((a, b) => String(a.index ?? "").localeCompare(String(b.index ?? "")) || String(a.id).localeCompare(String(b.id))),
  files: clone(scene.files ?? {}),
  appState: Object.fromEntries(Object.entries(scene.appState ?? {}).filter(([key]) => !["selectedElementIds", "selectedGroupIds", "activeTool", "editingElement", "hoveredElementIds"].includes(key))),
});

function mergeValue(base, left, right, path, conflicts) {
  if (equal(left, right)) return clone(left);
  if (equal(base, left)) return clone(right);
  if (equal(base, right)) return clone(left);
  if (Array.isArray(base) || Array.isArray(left) || Array.isArray(right) || left === null || right === null || typeof left !== "object" || typeof right !== "object") {
    conflicts.push({ path, base: clone(base), left: clone(left), right: clone(right) });
    return undefined;
  }
  const output = {};
  for (const key of [...new Set([...Object.keys(base ?? {}), ...Object.keys(left ?? {}), ...Object.keys(right ?? {})])].sort()) {
    if (["version", "versionNonce", "updated"].includes(key)) {
      output[key] = clone(left[key] ?? right[key]);
      continue;
    }
    const value = mergeValue(base?.[key], left?.[key], right?.[key], `${path}/${key}`, conflicts);
    if (value !== undefined) output[key] = value;
  }
  return output;
}

function validateIntegrity(scene) {
  const ids = new Set(scene.elements.map(({ id }) => id));
  for (const element of scene.elements) {
    for (const binding of [element.startBinding, element.endBinding].filter(Boolean)) {
      if (!ids.has(binding.elementId)) throw new Error(`dangling binding:${element.id}:${binding.elementId}`);
    }
    for (const bound of element.boundElements ?? []) if (!ids.has(bound.id)) throw new Error(`dangling bound element:${element.id}:${bound.id}`);
    if (element.frameId && !ids.has(element.frameId)) throw new Error(`dangling frame:${element.id}:${element.frameId}`);
    if (element.containerId && !ids.has(element.containerId)) throw new Error(`dangling container:${element.id}:${element.containerId}`);
    if (element.fileId && !scene.files[element.fileId]) throw new Error(`missing asset:${element.id}:${element.fileId}`);
  }
}

function createLegacyController(initialScene, importedHistory = null) {
  let current = normalizeScene(initialScene);
  const versions = [];
  const snapshots = new Map();
  const pending = new Map();
  const undoStack = [];
  const redoStack = [];
  let currentVersionId = null;

  if (importedHistory) {
    for (const imported of importedHistory.versions ?? []) {
      const parents = clone(imported.parents ?? imported.parentIds ?? []);
      const version = Object.freeze({ id: imported.id, name: imported.name, parents: Object.freeze(parents) });
      versions.push(version);
      snapshots.set(imported.id, normalizeScene(importedHistory.snapshots?.[imported.id] ?? imported.scene));
    }
    currentVersionId = importedHistory.currentVersionId ?? versions.at(-1)?.id ?? null;
    if (currentVersionId && snapshots.has(currentVersionId)) current = clone(snapshots.get(currentVersionId));
  }

  const saveVersion = (name, scene = current) => {
    const normalizedName = String(name).normalize("NFC");
    if (!normalizedName.trim()) throw new Error("version name must be non-empty");
    if (versions.some((version) => version.name === normalizedName)) throw new Error("version name must be unique");
    const snapshot = normalizeScene(scene);
    validateIntegrity(snapshot);
    const parents = currentVersionId ? [currentVersionId] : [];
    const id = `version:${hash({ name: normalizedName, parents, snapshot })}`;
    const version = Object.freeze({ id, name: normalizedName, parents: Object.freeze(parents) });
    versions.push(version);
    snapshots.set(id, clone(snapshot));
    current = clone(snapshot);
    currentVersionId = id;
    return clone(version);
  };

  const checkout = (id) => {
    if (!snapshots.has(id)) throw new Error(`unknown version:${id}`);
    undoStack.push(clone(current));
    redoStack.length = 0;
    current = clone(snapshots.get(id));
    currentVersionId = id;
    return clone(current);
  };

  const merge = ({ name, baseId, leftId, rightId }) => {
    for (const id of [baseId, leftId, rightId]) if (!snapshots.has(id)) throw new Error(`unknown version:${id}`);
    const isAncestor = (ancestorId, descendantId) => {
      const pendingIds = [descendantId];
      const visited = new Set();
      while (pendingIds.length) {
        const id = pendingIds.pop();
        if (id === ancestorId) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        pendingIds.push(...(versions.find((version) => version.id === id)?.parents ?? []));
      }
      return false;
    };
    if (!isAncestor(baseId, leftId) || !isAncestor(baseId, rightId)) throw new Error("merge base must be a common ancestor");
    const [firstId, secondId] = [leftId, rightId].sort();
    const base = snapshots.get(baseId);
    const left = snapshots.get(firstId);
    const right = snapshots.get(secondId);
    const conflicts = [];
    const elementIds = [...new Set([...base.elements, ...left.elements, ...right.elements].map(({ id }) => id))].sort();
    const byId = (scene, id) => scene.elements.find((element) => element.id === id);
    const elements = [];
    for (const id of elementIds) {
      const baseElement = byId(base, id);
      const leftElement = byId(left, id);
      const rightElement = byId(right, id);
      if (!leftElement || !rightElement) {
        if (!baseElement) elements.push(clone(leftElement ?? rightElement));
        else if (equal(baseElement, leftElement ?? rightElement)) continue;
        else conflicts.push({ path: `/elements/${id}`, base: clone(baseElement), left: clone(leftElement), right: clone(rightElement), kind: "modify-delete" });
        continue;
      }
      const merged = mergeValue(cleanElement(baseElement ?? {}), cleanElement(leftElement), cleanElement(rightElement), `/elements/${id}`, conflicts);
      if (merged !== undefined) elements.push(merged);
    }
    const files = mergeValue(base.files, left.files, right.files, "/files", conflicts) ?? {};
    const appState = mergeValue(base.appState, left.appState, right.appState, "/appState", conflicts) ?? {};
    const stableConflicts = conflicts.map((conflict) => Object.freeze({ ...conflict, id: `conflict:${hash(conflict)}` })).sort((a, b) => a.id.localeCompare(b.id));
    const parents = [leftId, rightId].sort();
    const proposal = { name, parents, scene: normalizeScene({ elements, files, appState }), conflicts: stableConflicts };
    if (stableConflicts.length) {
      const mergeId = `merge:${hash({ baseId, parents, conflicts: stableConflicts })}`;
      pending.set(mergeId, proposal);
      return { status: "conflicts", mergeId, conflicts: clone(stableConflicts) };
    }
    return finishMerge(proposal);
  };

  const finishMerge = (proposal) => {
    validateIntegrity(proposal.scene);
    undoStack.push(clone(current));
    redoStack.length = 0;
    const normalizedName = String(proposal.name).normalize("NFC");
    if (!normalizedName.trim() || versions.some((version) => version.name === normalizedName)) throw new Error("invalid merge name");
    const id = `version:${hash({ name: normalizedName, parents: proposal.parents, snapshot: proposal.scene })}`;
    const version = Object.freeze({ id, name: normalizedName, parents: Object.freeze(proposal.parents) });
    versions.push(version);
    snapshots.set(id, clone(proposal.scene));
    current = clone(proposal.scene);
    currentVersionId = id;
    return { status: "merged", version: clone(version), scene: clone(current) };
  };

  const resolveMerge = (mergeId, resolutions) => {
    const proposal = pending.get(mergeId);
    if (!proposal) throw new Error("unknown pending merge");
    if (proposal.conflicts.some(({ id }) => !(id in resolutions))) throw new Error("all conflicts require explicit resolution");
    const resolved = clone(proposal.scene);
    for (const conflict of proposal.conflicts) {
      const choice = resolutions[conflict.id];
      const value = choice === "left" ? conflict.left : choice === "right" ? conflict.right : choice;
      const parts = conflict.path.split("/").slice(1);
      if (parts[0] === "elements") {
        const elementId = parts[1];
        let element = resolved.elements.find((candidate) => candidate.id === elementId);
        if (parts.length === 2) {
          resolved.elements = resolved.elements.filter((candidate) => candidate.id !== elementId);
          if (value !== undefined) resolved.elements.push(clone(value));
          continue;
        }
        if (!element) {
          element = { id: elementId };
          resolved.elements.push(element);
        }
        let target = element;
        for (const part of parts.slice(2, -1)) target = target[part] ??= {};
        target[parts.at(-1)] = clone(value);
      } else if (parts[0] === "files") {
        resolved.files[parts[1]] = clone(value);
      } else if (parts[0] === "appState") {
        resolved.appState[parts[1]] = clone(value);
      }
    }
    pending.delete(mergeId);
    return finishMerge({ ...proposal, scene: normalizeScene(resolved) });
  };

  return Object.freeze({
    saveVersion,
    checkout,
    merge,
    resolveMerge,
    getCurrentScene: () => clone(current),
    getVersions: () => clone(versions),
    exportHistory: () => clone({ type: "excalidraw-scene-history", schemaVersion: 1, currentVersionId, versions, snapshots: Object.fromEntries(snapshots) }),
    undo: () => {
      if (!undoStack.length) return false;
      redoStack.push(clone(current));
      current = undoStack.pop();
      return true;
    },
    redo: () => {
      if (!redoStack.length) return false;
      undoStack.push(clone(current));
      current = redoStack.pop();
      return true;
    },
  });
}

export function importSceneHistory(value) {
  if (typeof value === "string") value = JSON.parse(value);
  if (value?.type === "excalidraw-scene-history") {
    if (value.schemaVersion !== 1) throw new Error("unsupported history schema");
    const initial = value.currentVersionId ? value.snapshots[value.currentVersionId] : { elements: [], files: {}, appState: {} };
    return createSceneHistoryController(initial, null, value);
  }
  if (value?.type === "excalidraw" && [1, 2].includes(value.version)) return createSceneHistoryController(value);
  throw new Error("unsupported Excalidraw document");
}

export function createSceneHistoryController(initialScene, editor = null, importedHistory = null) {
  const legacy = createLegacyController(initialScene, importedHistory);
  const captureEditorScene = () => editor ? { elements: editor.getSceneElements(), files: editor.getFiles(), appState: editor.getAppState() } : legacy.getCurrentScene();
  const applyEditorScene = (scene) => { if (editor) { editor.addFiles(Object.values(scene.files ?? {})); editor.updateScene({ elements: scene.elements, appState: scene.appState, captureUpdate: "IMMEDIATELY" }); } return scene; };
  return Object.freeze({
    saveVersion({ name, parentVersionId, scene }) {
      if (parentVersionId !== null && parentVersionId !== undefined) legacy.checkout(parentVersionId);
      const version = legacy.saveVersion(name, scene ?? captureEditorScene());
      return { ...version, parentIds: version.parents };
    },
    checkout(versionId) { return applyEditorScene(legacy.checkout(versionId)); },
    mergeVersions({ name, baseVersionId, versionIds, resolutions }) {
      const result = legacy.merge({ name, baseId: baseVersionId, leftId: versionIds[0], rightId: versionIds[1] });
      if (result.status === "conflicts" && resolutions) { const resolved = legacy.resolveMerge(result.mergeId, resolutions); applyEditorScene(resolved.scene); return resolved; }
      if (result.status === "merged") applyEditorScene(result.scene);
      return result;
    },
    resolveMerge(mergeId, resolutions) { const result = legacy.resolveMerge(mergeId, resolutions); applyEditorScene(result.scene); return result; },
    getCurrentScene: legacy.getCurrentScene,
    listVersions: () => legacy.getVersions().map((version) => ({ ...version, parentIds: version.parents })),
    exportHistory: () => JSON.stringify(legacy.exportHistory()),
    exportCurrentScene: () => JSON.stringify(legacy.getCurrentScene()),
    undo: legacy.undo,
    redo: legacy.redo,
  });
}

export function SceneHistoryPanel({ controller }) {
  const ask = (label) => globalThis.prompt?.(label) ?? "";
  let pending = null;
  return {
    type: "section",
    props: {
      role: "region",
      "aria-label": "Scene history",
      controller,
      children: [
        { type: "button", props: { children: "Save version", onClick: () => controller.saveVersion({ name: ask("Version name"), parentVersionId: null, scene: controller.getCurrentScene() }) } },
        { type: "button", props: { children: "Checkout version", onClick: () => controller.checkout(ask("Version ID")) } },
        { type: "button", props: { children: "Merge versions", onClick: () => { const result = controller.mergeVersions({ name: ask("Merge name"), baseVersionId: ask("Base version ID"), versionIds: ask("Version IDs, comma separated").split(",").map((value) => value.trim()) }); if (result?.status === "conflicts") pending = result; } } },
        { type: "button", props: { children: "Resolve conflicts", onClick: () => { if (pending) controller.resolveMerge(pending.mergeId, JSON.parse(ask("Conflict resolutions JSON") || "{}")); pending = null; } } },
        { type: "button", props: { children: "Export history", onClick: () => controller.exportHistory() } },
      ],
    },
  };
}
