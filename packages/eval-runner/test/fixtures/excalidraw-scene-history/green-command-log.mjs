import { createHash } from "node:crypto";

const copy = (value) => structuredClone(value);
const stable = (value) => JSON.stringify(value, (_, item) => item && typeof item === "object" && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
  : item);
const digest = (value) => createHash("sha256").update(stable(value)).digest("hex").slice(0, 16);
const sanitize = (scene) => ({
  type: "excalidraw",
  version: 2,
  elements: copy(scene.elements ?? []).sort((a, b) => `${a.index ?? ""}:${a.id}`.localeCompare(`${b.index ?? ""}:${b.id}`)),
  files: copy(scene.files ?? {}),
  appState: Object.fromEntries(Object.entries(scene.appState ?? {}).filter(([key]) => !key.startsWith("selected") && !["activeTool", "editingElement"].includes(key))),
});

function createCommandLogController(initialScene, importedHistory = null) {
  const state = { scene: sanitize(initialScene), head: null, versions: new Map(), order: [], undo: [], redo: [], pending: new Map() };
  if (importedHistory) {
    for (const imported of importedHistory.versions ?? []) {
      const parents = copy(imported.parents ?? imported.parentIds ?? []);
      const scene = sanitize(importedHistory.snapshots?.[imported.id] ?? imported.scene);
      state.versions.set(imported.id, { id: imported.id, name: imported.name, parents, scene });
      state.order.push(imported.id);
    }
    state.head = importedHistory.currentVersionId ?? state.order.at(-1) ?? null;
    if (state.head) state.scene = snapshot(state.head);
  }
  const snapshot = (id) => copy(state.versions.get(id).scene);
  const saveVersion = (name, next = state.scene) => {
    name = String(name).normalize("NFC");
    if (!name.trim() || state.order.some((id) => state.versions.get(id).name === name)) throw new Error("invalid version name");
    const scene = sanitize(next);
    assertLinks(scene);
    const parents = state.head ? [state.head] : [];
    const id = `v-${digest({ name, parents, scene })}`;
    state.versions.set(id, { id, name, parents, scene });
    state.order.push(id);
    state.head = id;
    state.scene = copy(scene);
    return copy(state.versions.get(id));
  };
  const checkout = (id) => {
    state.undo.push(copy(state.scene));
    state.redo.length = 0;
    state.scene = snapshot(id);
    state.head = id;
    return copy(state.scene);
  };
  const merge = (request) => {
    const isAncestor = (ancestorId, descendantId) => {
      const pendingIds = [descendantId];
      const visited = new Set();
      while (pendingIds.length) {
        const id = pendingIds.pop();
        if (id === ancestorId) return true;
        if (visited.has(id)) continue;
        visited.add(id);
        pendingIds.push(...(state.versions.get(id)?.parents ?? []));
      }
      return false;
    };
    if (!isAncestor(request.baseId, request.leftId) || !isAncestor(request.baseId, request.rightId)) throw new Error("merge base must be a common ancestor");
    const parents = [request.leftId, request.rightId].sort();
    const base = snapshot(request.baseId);
    const left = snapshot(parents[0]);
    const right = snapshot(parents[1]);
    const conflicts = [];
    const scene = threeWay(base, left, right, conflicts);
    const identified = conflicts.map((entry) => ({ ...entry, id: `c-${digest(entry)}` })).sort((a, b) => a.id.localeCompare(b.id));
    if (identified.length) {
      const mergeId = `m-${digest({ parents, identified })}`;
      state.pending.set(mergeId, { request, parents, scene, conflicts: identified });
      return { status: "conflicts", mergeId, conflicts: copy(identified) };
    }
    return commitMerge(request.name, parents, scene);
  };
  const commitMerge = (name, parents, scene) => {
    assertLinks(scene);
    state.undo.push(copy(state.scene));
    state.redo.length = 0;
    name = String(name).normalize("NFC");
    if (!name.trim() || state.order.some((id) => state.versions.get(id).name === name)) throw new Error("invalid merge name");
    const id = `v-${digest({ name, parents, scene })}`;
    state.versions.set(id, { id, name, parents, scene: sanitize(scene) });
    state.order.push(id);
    state.head = id;
    state.scene = snapshot(id);
    return { status: "merged", version: copy(state.versions.get(id)), scene: copy(state.scene) };
  };
  const resolveMerge = (id, choices) => {
    const operation = state.pending.get(id);
    if (!operation || operation.conflicts.some((conflict) => !(conflict.id in choices))) throw new Error("explicit resolutions required");
    const scene = copy(operation.scene);
    for (const conflict of operation.conflicts) apply(scene, conflict.path, choices[conflict.id] === "left" ? conflict.left : choices[conflict.id] === "right" ? conflict.right : choices[conflict.id]);
    state.pending.delete(id);
    return commitMerge(operation.request.name, operation.parents, scene);
  };
  return Object.freeze({
    saveVersion, checkout, merge, resolveMerge,
    getCurrentScene: () => copy(state.scene),
    getVersions: () => state.order.map((id) => copy(state.versions.get(id))),
    exportHistory: () => ({ type: "excalidraw-scene-history", schemaVersion: 1, currentVersionId: state.head, versions: state.order.map((id) => copy(state.versions.get(id))), snapshots: Object.fromEntries(state.order.map((id) => [id, snapshot(id)])) }),
    undo: () => state.undo.length ? (state.redo.push(copy(state.scene)), state.scene = state.undo.pop(), true) : false,
    redo: () => state.redo.length ? (state.undo.push(copy(state.scene)), state.scene = state.redo.pop(), true) : false,
  });
}

function threeWay(base, left, right, conflicts) {
  const merge = (b, l, r, path) => {
    if (stable(l) === stable(r)) return copy(l);
    if (stable(b) === stable(l)) return copy(r);
    if (stable(b) === stable(r)) return copy(l);
    if (Array.isArray(l) || Array.isArray(r) || l === null || r === null || typeof l !== "object" || typeof r !== "object") {
      conflicts.push({ path, base: copy(b), left: copy(l), right: copy(r) });
      return undefined;
    }
    const result = {};
    for (const key of [...new Set([...Object.keys(b ?? {}), ...Object.keys(l ?? {}), ...Object.keys(r ?? {})])].sort()) {
      if (["version", "versionNonce", "updated"].includes(key)) { result[key] = copy(l[key] ?? r[key]); continue; }
      const value = merge(b?.[key], l?.[key], r?.[key], `${path}/${key}`);
      if (value !== undefined) result[key] = value;
    }
    return result;
  };
  const byId = (scene, id) => scene.elements.find((element) => element.id === id);
  const ids = [...new Set([...base.elements, ...left.elements, ...right.elements].map(({ id }) => id))].sort();
  const elements = [];
  for (const id of ids) {
    const baseElement = byId(base, id);
    const leftElement = byId(left, id);
    const rightElement = byId(right, id);
    if (!baseElement && (!leftElement || !rightElement)) {
      elements.push(copy(leftElement ?? rightElement));
      continue;
    }
    if (baseElement && (!leftElement || !rightElement)) {
      const survivor = leftElement ?? rightElement;
      if (stable(baseElement) === stable(survivor)) continue;
      conflicts.push({ path: `/elements/${id}`, kind: "modify-delete", base: copy(baseElement), left: copy(leftElement), right: copy(rightElement) });
      continue;
    }
    const value = merge(baseElement, leftElement, rightElement, `/elements/${id}`);
    if (value !== undefined) elements.push(value);
  }
  return sanitize({
    elements,
    files: merge(base.files, left.files, right.files, "/files") ?? {},
    appState: merge(base.appState, left.appState, right.appState, "/appState") ?? {},
  });
}

function apply(scene, path, value) {
  const parts = path.split("/").slice(1);
  let target = scene;
  if (parts[0] === "elements") {
    const id = parts[1];
    let element = scene.elements.find((candidate) => candidate.id === id);
    if (!element) scene.elements.push(element = { id });
    target = element;
    parts.splice(0, 2);
  }
  for (const part of parts.slice(0, -1)) target = target[part] ??= {};
  target[parts.at(-1)] = copy(value);
}

function assertLinks(scene) {
  const ids = new Set(scene.elements.map(({ id }) => id));
  for (const element of scene.elements) {
    for (const key of ["startBinding", "endBinding"]) if (element[key] && !ids.has(element[key].elementId)) throw new Error("dangling binding");
    if (element.groupIds && !Array.isArray(element.groupIds)) throw new Error("invalid groups");
    if (element.fileId && !scene.files[element.fileId]) throw new Error("missing asset");
  }
}

export function importSceneHistory(value) {
  if (typeof value === "string") value = JSON.parse(value);
  if (value?.type === "excalidraw-scene-history" && value.schemaVersion !== 1) throw new Error("unsupported history schema");
  if (value?.type === "excalidraw" && (value.version === 1 || value.version === 2)) return createSceneHistoryController(value);
  if (value?.type === "excalidraw-scene-history" && value.schemaVersion === 1) return createSceneHistoryController(value.snapshots[value.currentVersionId], value);
  throw new Error("unsupported document");
}

export function createSceneHistoryController(initialScene, importedHistory = null) {
  const legacy = createCommandLogController(initialScene, importedHistory);
  return Object.freeze({
    saveVersion({ name, parentVersionId, scene }) {
      if (parentVersionId !== null && parentVersionId !== undefined) legacy.checkout(parentVersionId);
      const version = legacy.saveVersion(name, scene);
      return { ...version, parentIds: version.parents };
    },
    checkout: legacy.checkout,
    mergeVersions({ name, baseVersionId, versionIds, resolutions }) {
      const result = legacy.merge({ name, baseId: baseVersionId, leftId: versionIds[0], rightId: versionIds[1] });
      if (result.status === "conflicts" && resolutions) return legacy.resolveMerge(result.mergeId, resolutions);
      return result;
    },
    resolveMerge: legacy.resolveMerge,
    getCurrentScene: legacy.getCurrentScene,
    listVersions: () => legacy.getVersions().map((version) => ({ ...version, parentIds: version.parents })),
    exportHistory: () => JSON.stringify(legacy.exportHistory()),
    exportCurrentScene: () => JSON.stringify(legacy.getCurrentScene()),
    undo: legacy.undo,
    redo: legacy.redo,
  });
}

export function SceneHistoryPanel({ controller }) {
  return {
    type: "section",
    props: {
      role: "region",
      "aria-label": "Scene history",
      controller,
      children: [
        { type: "button", props: { children: "Save version" } },
        { type: "button", props: { children: "Checkout version" } },
        { type: "button", props: { children: "Merge versions" } },
        { type: "button", props: { children: "Resolve conflicts" } },
        { type: "button", props: { children: "Export history" } },
      ],
    },
  };
}
