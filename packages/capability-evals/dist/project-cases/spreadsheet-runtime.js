import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, copyFile, lstat, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile, } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
export const SPREADSHEET_RUNTIME_SOURCE_SHA256 = "5ecc2435a8dccd96131f48e9fa1cd8f439955951e99cc44922fef7aed1004497";
export class SpreadsheetRuntimeError extends Error {
    detail;
    constructor(message, detail = "") {
        super(message);
        this.name = "SpreadsheetRuntimeError";
        this.detail = detail;
    }
}
const DEFAULT_MAX_WORKBOOK_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_SHEETS = 64;
const DEFAULT_MAX_CELLS_PER_SHEET = 250_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BRIDGE_OUTPUT_BYTES = 128 * 1024 * 1024;
const execFileAsync = promisify(execFile);
export async function inspectSpreadsheetWorkbook(options) {
    validateOptions(options);
    const workbookPath = await requireRegularFile(options.workbookPath, "workbook");
    const nodeExecutable = await requireRegularFile(options.runtime.nodeExecutable, "Node executable");
    const nodeModulesPath = await requireDirectory(options.runtime.nodeModulesPath, "Node modules directory");
    await validateRuntimeIdentity(nodeExecutable, nodeModulesPath, options.runtime);
    const workbookBytes = await readFile(workbookPath);
    const maxWorkbookBytes = options.runtime.maxWorkbookBytes ?? DEFAULT_MAX_WORKBOOK_BYTES;
    if (workbookBytes.byteLength > maxWorkbookBytes) {
        throw new SpreadsheetRuntimeError(`Workbook exceeds the ${maxWorkbookBytes}-byte runtime limit.`, `Received ${workbookBytes.byteLength} bytes.`);
    }
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "relayer-spreadsheet-runtime-"));
    const bridgePath = join(temporaryDirectory, "bridge.mjs");
    const isolatedWorkbookPath = join(temporaryDirectory, "candidate.xlsx");
    try {
        await symlink(nodeModulesPath, join(temporaryDirectory, "node_modules"), "dir");
        await copyFile(workbookPath, isolatedWorkbookPath);
        await writeFile(bridgePath, BRIDGE_SOURCE, { encoding: "utf8", mode: 0o600 });
        const request = JSON.stringify({
            workbookPath: isolatedWorkbookPath,
            mutations: options.mutations ?? [],
            render: options.render ?? false,
            maxSheets: options.runtime.maxSheets ?? DEFAULT_MAX_SHEETS,
            maxCellsPerSheet: options.runtime.maxCellsPerSheet ?? DEFAULT_MAX_CELLS_PER_SHEET,
        });
        const stdout = await runBridge({
            nodeExecutable,
            bridgePath,
            request,
            cwd: temporaryDirectory,
            timeoutMs: options.runtime.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        });
        const envelope = parseBridgeEnvelope(stdout);
        if (!envelope.ok) {
            throw new SpreadsheetRuntimeError("Spreadsheet bridge rejected the workbook.", envelope.error.message);
        }
        return Object.freeze({
            schemaVersion: 1,
            workbookDigest: sha256(workbookBytes),
            runtimeEnvironmentDigest: options.runtime.environmentDigest,
            bridgeDigest: sha256(BRIDGE_SOURCE),
            inspectionNdjson: envelope.receipt.inspectionNdjson,
            sheets: deepFreeze(envelope.receipt.sheets),
            mutations: deepFreeze(envelope.receipt.mutations),
            renders: deepFreeze(envelope.receipt.renders),
        });
    }
    finally {
        await rm(temporaryDirectory, { recursive: true, force: true });
    }
}
export async function preflightSpreadsheetRuntime(runtime) {
    try {
        validateOptions({ workbookPath: "/preflight.xlsx", runtime });
        const nodeExecutable = await requireRegularFile(runtime.nodeExecutable, "Node executable");
        const nodeModulesPath = await requireDirectory(runtime.nodeModulesPath, "Node modules directory");
        await validateRuntimeIdentity(nodeExecutable, nodeModulesPath, runtime);
        return { available: true };
    }
    catch (error) {
        return { available: false, reason: error instanceof Error ? error.message : String(error) };
    }
}
async function runBridge(options) {
    const environment = {
        TMPDIR: options.cwd,
        TZ: "UTC",
        LANG: "C",
        LC_ALL: "C",
        PATH: dirname(options.nodeExecutable),
    };
    try {
        const result = await execFileAsync(options.nodeExecutable, [options.bridgePath, options.request], {
            cwd: options.cwd,
            env: environment,
            encoding: "utf8",
            timeout: options.timeoutMs,
            maxBuffer: MAX_BRIDGE_OUTPUT_BYTES,
            windowsHide: true,
        });
        return String(result.stdout);
    }
    catch (error) {
        const failure = error;
        const stdout = String(failure.stdout ?? "");
        if (stdout.trim() !== "")
            return stdout;
        throw new SpreadsheetRuntimeError("Spreadsheet bridge process failed.", String(failure.stderr ?? failure.message).trim());
    }
}
function parseBridgeEnvelope(stdout) {
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        throw new SpreadsheetRuntimeError("Spreadsheet bridge returned invalid JSON.", stdout.slice(-2_000));
    }
    if (!isRecord(parsed) || typeof parsed.ok !== "boolean") {
        throw new SpreadsheetRuntimeError("Spreadsheet bridge returned an invalid envelope.");
    }
    if (parsed.ok === false) {
        const error = parsed.error;
        if (!isRecord(error) || typeof error.message !== "string" || error.message.trim() === "") {
            throw new SpreadsheetRuntimeError("Spreadsheet bridge returned an invalid failure receipt.");
        }
        return { ok: false, error: { message: error.message } };
    }
    const receipt = parsed.receipt;
    if (!isRecord(receipt)
        || typeof receipt.inspectionNdjson !== "string"
        || !Array.isArray(receipt.sheets)
        || !Array.isArray(receipt.mutations)
        || !Array.isArray(receipt.renders)) {
        throw new SpreadsheetRuntimeError("Spreadsheet bridge returned an invalid success receipt.");
    }
    return parsed;
}
function validateOptions(options) {
    if (!isAbsolute(options.workbookPath))
        throw new SpreadsheetRuntimeError("Workbook path must be absolute.");
    if (!isAbsolute(options.runtime.nodeExecutable)) {
        throw new SpreadsheetRuntimeError("Injected Node executable path must be absolute.");
    }
    if (!isAbsolute(options.runtime.nodeModulesPath)) {
        throw new SpreadsheetRuntimeError("Injected node_modules path must be absolute.");
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(options.runtime.environmentDigest)) {
        throw new SpreadsheetRuntimeError("Spreadsheet runtime requires a content-addressed environment digest.");
    }
    requireText(options.runtime.nodeVersion, "nodeVersion");
    requireText(options.runtime.artifactToolVersion, "artifactToolVersion");
    requireDigest(options.runtime.nodeExecutableDigest, "nodeExecutableDigest");
    requireDigest(options.runtime.artifactToolEntrypointDigest, "artifactToolEntrypointDigest");
    requireDigest(options.runtime.artifactToolContentDigest, "artifactToolContentDigest");
    requirePositiveInteger(options.runtime.timeoutMs, "timeoutMs");
    requirePositiveInteger(options.runtime.maxWorkbookBytes, "maxWorkbookBytes");
    requirePositiveInteger(options.runtime.maxSheets, "maxSheets");
    requirePositiveInteger(options.runtime.maxCellsPerSheet, "maxCellsPerSheet");
    for (const [index, mutation] of (options.mutations ?? []).entries()) {
        if (mutation.sheetName !== undefined)
            requireText(mutation.sheetName, `mutation ${index} sheetName`);
        if (mutation.kind === "table-cell") {
            requireText(mutation.keyHeader, `mutation ${index} keyHeader`);
            requireText(mutation.targetHeader, `mutation ${index} targetHeader`);
            if (mutation.occurrence !== undefined
                && (!Number.isInteger(mutation.occurrence) || mutation.occurrence < 0)) {
                throw new SpreadsheetRuntimeError(`Mutation ${index} occurrence must be a non-negative integer.`);
            }
            validateCellValue(mutation.keyValue, `mutation ${index} keyValue`);
        }
        else if (mutation.kind === "label-value") {
            if (mutation.labels.length === 0)
                throw new SpreadsheetRuntimeError(`Mutation ${index} labels must not be empty.`);
            mutation.labels.forEach((label, aliasIndex) => requireText(label, `mutation ${index} label ${aliasIndex}`));
        }
        else {
            throw new SpreadsheetRuntimeError(`Unsupported mutation kind at index ${index}.`);
        }
        validateCellValue(mutation.value, `mutation ${index} value`);
    }
}
async function validateRuntimeIdentity(nodeExecutable, nodeModulesPath, runtime) {
    let actualArtifactToolVersion = "";
    let actualNodeExecutableDigest;
    let actualArtifactToolEntrypointDigest;
    let actualArtifactToolContentDigest;
    try {
        const manifest = JSON.parse(await readFile(join(nodeModulesPath, "@oai", "artifact-tool", "package.json"), "utf8"));
        if (manifest.name !== "@oai/artifact-tool" || typeof manifest.version !== "string")
            throw new Error("invalid package manifest");
        actualArtifactToolVersion = manifest.version;
        actualNodeExecutableDigest = sha256(await readFile(nodeExecutable));
        actualArtifactToolEntrypointDigest = sha256(await readFile(join(nodeModulesPath, "@oai", "artifact-tool", "dist", "artifact_tool.mjs")));
        actualArtifactToolContentDigest = await directoryContentDigest(join(nodeModulesPath, "@oai", "artifact-tool"));
    }
    catch (error) {
        throw new SpreadsheetRuntimeError("Injected artifact-tool runtime identity could not be verified.", error instanceof Error ? error.message : String(error));
    }
    if (actualArtifactToolVersion !== runtime.artifactToolVersion
        || actualNodeExecutableDigest !== runtime.nodeExecutableDigest
        || actualArtifactToolEntrypointDigest !== runtime.artifactToolEntrypointDigest
        || actualArtifactToolContentDigest !== runtime.artifactToolContentDigest) {
        throw new SpreadsheetRuntimeError("Injected spreadsheet runtime does not match the sealed environment contract.", `Expected Node ${runtime.nodeVersion} (${runtime.nodeExecutableDigest}) and @oai/artifact-tool ${runtime.artifactToolVersion} (${runtime.artifactToolEntrypointDigest}, ${runtime.artifactToolContentDigest}); received ${actualNodeExecutableDigest} and @oai/artifact-tool ${actualArtifactToolVersion} (${actualArtifactToolEntrypointDigest}, ${actualArtifactToolContentDigest}).`);
    }
    let actualNodeVersion = "";
    try {
        const result = await execFileAsync(nodeExecutable, ["--version"], {
            env: { PATH: dirname(nodeExecutable) },
            encoding: "utf8",
            timeout: 10_000,
            maxBuffer: 64 * 1024,
        });
        actualNodeVersion = String(result.stdout).trim().replace(/^v/, "");
    }
    catch (error) {
        throw new SpreadsheetRuntimeError("Injected Node runtime identity could not be verified.", error instanceof Error ? error.message : String(error));
    }
    if (actualNodeVersion !== runtime.nodeVersion) {
        throw new SpreadsheetRuntimeError("Injected Node runtime version does not match the sealed environment contract.", `Expected Node ${runtime.nodeVersion}; received ${actualNodeVersion}.`);
    }
}
async function directoryContentDigest(directory) {
    const entries = [];
    const visit = async (current, relative = "") => {
        for (const entry of (await readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
            const child = join(current, entry.name);
            const name = join(relative, entry.name);
            if (entry.isSymbolicLink())
                throw new SpreadsheetRuntimeError("Injected artifact-tool package contains a symbolic link.", name);
            if (entry.isDirectory())
                await visit(child, name);
            else if (entry.isFile())
                entries.push(`${name}\0${sha256(await readFile(child))}`);
        }
    };
    await visit(directory);
    return sha256(entries.join("\n"));
}
function validateCellValue(value, label) {
    if (value !== null && typeof value !== "string" && typeof value !== "boolean"
        && !(typeof value === "number" && Number.isFinite(value))) {
        throw new SpreadsheetRuntimeError(`${label} must be a finite scalar spreadsheet value.`);
    }
}
function requirePositiveInteger(value, label) {
    if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
        throw new SpreadsheetRuntimeError(`${label} must be a positive integer.`);
    }
}
function requireText(value, label) {
    if (value.trim() === "")
        throw new SpreadsheetRuntimeError(`${label} must not be empty.`);
}
function requireDigest(value, label) {
    if (!/^sha256:[a-f0-9]{64}$/.test(value))
        throw new SpreadsheetRuntimeError(`${label} must be a SHA-256 digest.`);
}
async function requireRegularFile(path, label) {
    await access(path).catch(() => {
        throw new SpreadsheetRuntimeError(`${label} does not exist: ${path}`);
    });
    const resolved = await realpath(path);
    const metadata = await lstat(resolved);
    if (!metadata.isFile())
        throw new SpreadsheetRuntimeError(`${label} is not a regular file: ${path}`);
    return resolved;
}
async function requireDirectory(path, label) {
    await access(path).catch(() => {
        throw new SpreadsheetRuntimeError(`${label} does not exist: ${path}`);
    });
    const resolved = await realpath(path);
    const metadata = await lstat(resolved);
    if (!metadata.isDirectory())
        throw new SpreadsheetRuntimeError(`${label} is not a directory: ${path}`);
    return resolved;
}
function sha256(value) {
    return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function deepFreeze(value) {
    if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const child of Object.values(value))
            deepFreeze(child);
    }
    return value;
}
const BRIDGE_SOURCE = String.raw `
import { createHash } from "node:crypto";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const countItems = (collection) => Array.isArray(collection?.items) ? collection.items.length : 0;
const digest = (bytes) => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const pngSize = (bytes) => {
  if (bytes.length < 24 || bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) {
    throw new Error("Spreadsheet renderer did not return a PNG image.");
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

function sheetItems(workbook) {
  const items = workbook.worksheets?.items;
  if (!Array.isArray(items)) throw new Error("Artifact runtime did not expose a worksheet collection.");
  return items;
}

function usedRangeSnapshot(sheet, maxCellsPerSheet) {
  let range;
  try { range = sheet.getUsedRange(); } catch { range = null; }
  if (!range) return { range: null, values: [], formulas: [], rowCount: 0, columnCount: 0 };
  const values = Array.isArray(range.values) ? range.values : [];
  const formulas = Array.isArray(range.formulas) ? range.formulas : [];
  const rowCount = values.length;
  const columnCount = Math.max(0, ...values.map((row) => Array.isArray(row) ? row.length : 0));
  if (rowCount * columnCount > maxCellsPerSheet) {
    throw new Error("Sheet " + sheet.name + " exceeds the " + maxCellsPerSheet + "-cell inspection limit.");
  }
  return { range, values, formulas, rowCount, columnCount };
}

function semanticMatches(sheets, mutation, maxCellsPerSheet) {
  const matches = [];
  for (const sheet of sheets) {
    if (mutation.sheetName !== undefined && sheet.name !== mutation.sheetName) continue;
    const snapshot = usedRangeSnapshot(sheet, maxCellsPerSheet);
    for (let headerRow = 0; headerRow < snapshot.values.length; headerRow += 1) {
      const row = snapshot.values[headerRow] ?? [];
      const keyColumns = [];
      const targetColumns = [];
      for (let column = 0; column < row.length; column += 1) {
        const header = normalize(row[column]);
        if (header === normalize(mutation.keyHeader)) keyColumns.push(column);
        if (header === normalize(mutation.targetHeader)) targetColumns.push(column);
      }
      for (const keyColumn of keyColumns) for (const targetColumn of targetColumns) {
        for (let dataRow = headerRow + 1; dataRow < snapshot.values.length; dataRow += 1) {
          const candidate = snapshot.values[dataRow] ?? [];
          if (normalize(candidate[keyColumn]) !== normalize(mutation.keyValue)) continue;
          matches.push({ sheet, range: snapshot.range, row: dataRow, column: targetColumn, previousValue: candidate[targetColumn] });
        }
      }
    }
  }
  return matches;
}

function labelValueMatches(sheets, mutation, maxCellsPerSheet) {
  const aliases = new Set(mutation.labels.map(normalize));
  const matches = [];
  for (const sheet of sheets) {
    if (mutation.sheetName !== undefined && sheet.name !== mutation.sheetName) continue;
    const snapshot = usedRangeSnapshot(sheet, maxCellsPerSheet);
    for (let row = 0; row < snapshot.values.length; row += 1) {
      const values = snapshot.values[row] ?? [];
      for (let column = 0; column < values.length; column += 1) {
        if (!aliases.has(normalize(values[column]))) continue;
        for (let offset = 1; offset <= 3; offset += 1) {
          const candidate = values[column + offset];
          if (candidate === null || candidate === undefined || String(candidate).trim() === "") continue;
          matches.push({ sheet, range: snapshot.range, row, column: column + offset, previousValue: candidate });
          break;
        }
      }
    }
  }
  return matches;
}

async function main() {
  const request = JSON.parse(process.argv[2] ?? "null");
  if (!request || typeof request.workbookPath !== "string") throw new Error("Bridge request is missing workbookPath.");
  const input = await FileBlob.load(request.workbookPath);
  const workbook = await SpreadsheetFile.importXlsx(input);
  const initialSheets = sheetItems(workbook);
  if (initialSheets.length === 0) throw new Error("Workbook contains no worksheets.");
  if (initialSheets.length > request.maxSheets) throw new Error("Workbook exceeds the worksheet limit.");

  const mutations = [];
  for (const [mutationIndex, mutation] of request.mutations.entries()) {
    const matches = mutation.kind === "label-value"
      ? labelValueMatches(initialSheets, mutation, request.maxCellsPerSheet)
      : semanticMatches(initialSheets, mutation, request.maxCellsPerSheet);
    let selected;
    if (mutation.kind === "label-value" || mutation.occurrence === undefined) {
      if (matches.length !== 1) {
        throw new Error("Semantic mutation " + mutationIndex + " expected one match and found " + matches.length + ".");
      }
      selected = matches[0];
    } else {
      selected = matches[mutation.occurrence];
      if (!selected) throw new Error("Semantic mutation " + mutationIndex + " occurrence was not found.");
    }
    selected.range.getCell(selected.row, selected.column).values = [[mutation.value]];
    mutations.push({
      mutationIndex,
      sheetName: selected.sheet.name,
      relativeRow: selected.row,
      relativeColumn: selected.column,
      previousValue: selected.previousValue,
      value: mutation.value,
    });
  }

  // Artifact Tool recalculates automatically when inputs change. Inspecting and
  // reading the used ranges below observes the post-mutation calculated state.
  const inspection = await workbook.inspect({
    kind: "workbook,sheet,table,formula,drawing",
    maxChars: 2_000_000,
    tableMaxRows: 20,
    tableMaxCols: 30,
    options: { maxResults: 10_000 },
  });
  const sheets = [];
  const renders = [];
  for (const sheet of sheetItems(workbook)) {
    const snapshot = usedRangeSnapshot(sheet, request.maxCellsPerSheet);
    sheets.push({
      name: sheet.name,
      values: snapshot.values,
      formulas: snapshot.formulas,
      rowCount: snapshot.rowCount,
      columnCount: snapshot.columnCount,
      drawings: {
        charts: countItems(sheet.charts),
        shapes: countItems(sheet.shapes),
        images: countItems(sheet.images),
        sparklineGroups: countItems(sheet.sparklineGroups),
      },
    });
    if (request.render === true) {
      const rendered = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
      const bytes = Buffer.from(await rendered.arrayBuffer());
      const size = pngSize(bytes);
      if (bytes.length === 0 || size.width === 0 || size.height === 0) throw new Error("Sheet " + sheet.name + " rendered empty.");
      renders.push({
        sheetName: sheet.name,
        format: "png",
        byteLength: bytes.length,
        contentDigest: digest(bytes),
        width: size.width,
        height: size.height,
      });
    }
  }
  return { inspectionNdjson: String(inspection.ndjson ?? ""), sheets, mutations, renders };
}

try {
  const receipt = await main();
  process.stdout.write(JSON.stringify({ ok: true, receipt }));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(JSON.stringify({ ok: false, error: { message } }));
  process.exitCode = 1;
}
`;
