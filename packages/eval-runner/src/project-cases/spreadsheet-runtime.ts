import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  access,
  copyFile,
  lstat,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

export type SpreadsheetCellValue = string | number | boolean | null;

export interface SpreadsheetRuntimeConfig {
  /** Explicit executable supplied by the owning runtime. Ambient PATH lookup is prohibited. */
  readonly nodeExecutable: string;
  /** Explicit directory containing @oai/artifact-tool. Ambient module lookup is prohibited. */
  readonly nodeModulesPath: string;
  /** Content-addressed identity supplied by the runtime owner. */
  readonly environmentDigest: `sha256:${string}`;
  /** Exact versions sealed by the owning case's environment contract. */
  readonly nodeVersion: string;
  readonly artifactToolVersion: string;
  readonly nodeExecutableDigest: `sha256:${string}`;
  readonly artifactToolEntrypointDigest: `sha256:${string}`;
  readonly timeoutMs?: number;
  readonly maxWorkbookBytes?: number;
  readonly maxSheets?: number;
  readonly maxCellsPerSheet?: number;
}

/**
 * Finds a row by semantic headers and a stable key, then mutates the selected
 * column. It intentionally does not expose an A1-layout requirement.
 */
export interface SpreadsheetTableCellMutation {
  readonly kind: "table-cell";
  readonly sheetName?: string;
  readonly keyHeader: string;
  readonly keyValue: SpreadsheetCellValue;
  readonly targetHeader: string;
  readonly value: SpreadsheetCellValue;
  /** Zero-based match index. Omit to require exactly one semantic match. */
  readonly occurrence?: number;
}

export type SpreadsheetSemanticMutation = SpreadsheetTableCellMutation;

export interface SpreadsheetDrawingSnapshot {
  readonly charts: number;
  readonly shapes: number;
  readonly images: number;
  readonly sparklineGroups: number;
}

export interface SpreadsheetSheetSnapshot {
  readonly name: string;
  /** Matrices are relative to the sheet's used range, not a prescribed A1 location. */
  readonly values: readonly (readonly unknown[])[];
  readonly formulas: readonly (readonly unknown[])[];
  readonly rowCount: number;
  readonly columnCount: number;
  readonly drawings: SpreadsheetDrawingSnapshot;
}

export interface SpreadsheetMutationReceipt {
  readonly mutationIndex: number;
  readonly sheetName: string;
  readonly relativeRow: number;
  readonly relativeColumn: number;
  readonly previousValue: unknown;
  readonly value: SpreadsheetCellValue;
}

export interface SpreadsheetRenderReceipt {
  readonly sheetName: string;
  readonly format: "png";
  readonly byteLength: number;
  readonly contentDigest: `sha256:${string}`;
  readonly width: number;
  readonly height: number;
}

export interface SpreadsheetWorkbookReceipt {
  readonly schemaVersion: 1;
  readonly workbookDigest: `sha256:${string}`;
  readonly runtimeEnvironmentDigest: `sha256:${string}`;
  readonly bridgeDigest: `sha256:${string}`;
  readonly inspectionNdjson: string;
  readonly sheets: readonly SpreadsheetSheetSnapshot[];
  readonly mutations: readonly SpreadsheetMutationReceipt[];
  readonly renders: readonly SpreadsheetRenderReceipt[];
}

export interface InspectSpreadsheetWorkbookOptions {
  readonly workbookPath: string;
  readonly runtime: SpreadsheetRuntimeConfig;
  readonly mutations?: readonly SpreadsheetSemanticMutation[];
  /** Rendering is explicit because mutation-only recalculation should not render every sheet. */
  readonly render?: boolean;
}

export class SpreadsheetRuntimeError extends Error {
  readonly detail: string;

  constructor(message: string, detail = "") {
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

export async function inspectSpreadsheetWorkbook(
  options: InspectSpreadsheetWorkbookOptions,
): Promise<SpreadsheetWorkbookReceipt> {
  validateOptions(options);
  const workbookPath = await requireRegularFile(options.workbookPath, "workbook");
  const nodeExecutable = await requireRegularFile(options.runtime.nodeExecutable, "Node executable");
  const nodeModulesPath = await requireDirectory(options.runtime.nodeModulesPath, "Node modules directory");
  await validateRuntimeIdentity(nodeExecutable, nodeModulesPath, options.runtime);
  const workbookBytes = await readFile(workbookPath);
  const maxWorkbookBytes = options.runtime.maxWorkbookBytes ?? DEFAULT_MAX_WORKBOOK_BYTES;
  if (workbookBytes.byteLength > maxWorkbookBytes) {
    throw new SpreadsheetRuntimeError(
      `Workbook exceeds the ${maxWorkbookBytes}-byte runtime limit.`,
      `Received ${workbookBytes.byteLength} bytes.`,
    );
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
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

interface BridgeSuccessEnvelope {
  readonly ok: true;
  readonly receipt: {
    readonly inspectionNdjson: string;
    readonly sheets: SpreadsheetSheetSnapshot[];
    readonly mutations: SpreadsheetMutationReceipt[];
    readonly renders: SpreadsheetRenderReceipt[];
  };
}

interface BridgeFailureEnvelope {
  readonly ok: false;
  readonly error: { readonly message: string };
}

type BridgeEnvelope = BridgeSuccessEnvelope | BridgeFailureEnvelope;

async function runBridge(options: {
  readonly nodeExecutable: string;
  readonly bridgePath: string;
  readonly request: string;
  readonly cwd: string;
  readonly timeoutMs: number;
}): Promise<string> {
  const environment: NodeJS.ProcessEnv = {
    TMPDIR: options.cwd,
    TZ: "UTC",
    LANG: "C",
    LC_ALL: "C",
    PATH: dirname(options.nodeExecutable),
  };
  try {
    const result = await execFileAsync(
      options.nodeExecutable,
      [options.bridgePath, options.request],
      {
        cwd: options.cwd,
        env: environment,
        encoding: "utf8",
        timeout: options.timeoutMs,
        maxBuffer: MAX_BRIDGE_OUTPUT_BYTES,
        windowsHide: true,
      },
    );
    return String(result.stdout);
  } catch (error) {
    const failure = error as Error & { readonly stdout?: string | Buffer; readonly stderr?: string | Buffer };
    const stdout = String(failure.stdout ?? "");
    if (stdout.trim() !== "") return stdout;
    throw new SpreadsheetRuntimeError(
      "Spreadsheet bridge process failed.",
      String(failure.stderr ?? failure.message).trim(),
    );
  }
}

function parseBridgeEnvelope(stdout: string): BridgeEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
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
  return parsed as unknown as BridgeSuccessEnvelope;
}

function validateOptions(options: InspectSpreadsheetWorkbookOptions): void {
  if (!isAbsolute(options.workbookPath)) throw new SpreadsheetRuntimeError("Workbook path must be absolute.");
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
  requirePositiveInteger(options.runtime.timeoutMs, "timeoutMs");
  requirePositiveInteger(options.runtime.maxWorkbookBytes, "maxWorkbookBytes");
  requirePositiveInteger(options.runtime.maxSheets, "maxSheets");
  requirePositiveInteger(options.runtime.maxCellsPerSheet, "maxCellsPerSheet");
  for (const [index, mutation] of (options.mutations ?? []).entries()) {
    if (mutation.kind !== "table-cell") throw new SpreadsheetRuntimeError(`Unsupported mutation kind at index ${index}.`);
    requireText(mutation.keyHeader, `mutation ${index} keyHeader`);
    requireText(mutation.targetHeader, `mutation ${index} targetHeader`);
    if (mutation.sheetName !== undefined) requireText(mutation.sheetName, `mutation ${index} sheetName`);
    if (mutation.occurrence !== undefined
      && (!Number.isInteger(mutation.occurrence) || mutation.occurrence < 0)) {
      throw new SpreadsheetRuntimeError(`Mutation ${index} occurrence must be a non-negative integer.`);
    }
    validateCellValue(mutation.keyValue, `mutation ${index} keyValue`);
    validateCellValue(mutation.value, `mutation ${index} value`);
  }
}

async function validateRuntimeIdentity(
  nodeExecutable: string,
  nodeModulesPath: string,
  runtime: SpreadsheetRuntimeConfig,
): Promise<void> {
  let actualNodeVersion = "";
  try {
    const result = await execFileAsync(nodeExecutable, ["--version"], {
      env: { PATH: dirname(nodeExecutable) },
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 64 * 1024,
    });
    actualNodeVersion = String(result.stdout).trim().replace(/^v/, "");
  } catch (error) {
    throw new SpreadsheetRuntimeError("Injected Node runtime identity could not be verified.", error instanceof Error ? error.message : String(error));
  }
  let actualArtifactToolVersion = "";
  let actualNodeExecutableDigest: `sha256:${string}`;
  let actualArtifactToolEntrypointDigest: `sha256:${string}`;
  try {
    const manifest = JSON.parse(await readFile(join(nodeModulesPath, "@oai", "artifact-tool", "package.json"), "utf8")) as { name?: unknown; version?: unknown };
    if (manifest.name !== "@oai/artifact-tool" || typeof manifest.version !== "string") throw new Error("invalid package manifest");
    actualArtifactToolVersion = manifest.version;
    actualNodeExecutableDigest = sha256(await readFile(nodeExecutable));
    actualArtifactToolEntrypointDigest = sha256(await readFile(join(nodeModulesPath, "@oai", "artifact-tool", "dist", "artifact_tool.mjs")));
  } catch (error) {
    throw new SpreadsheetRuntimeError("Injected artifact-tool runtime identity could not be verified.", error instanceof Error ? error.message : String(error));
  }
  if (actualNodeVersion !== runtime.nodeVersion || actualArtifactToolVersion !== runtime.artifactToolVersion
    || actualNodeExecutableDigest !== runtime.nodeExecutableDigest
    || actualArtifactToolEntrypointDigest !== runtime.artifactToolEntrypointDigest) {
    throw new SpreadsheetRuntimeError(
      "Injected spreadsheet runtime does not match the sealed environment contract.",
      `Expected Node ${runtime.nodeVersion} (${runtime.nodeExecutableDigest}) and @oai/artifact-tool ${runtime.artifactToolVersion} (${runtime.artifactToolEntrypointDigest}); received Node ${actualNodeVersion} (${actualNodeExecutableDigest}) and @oai/artifact-tool ${actualArtifactToolVersion} (${actualArtifactToolEntrypointDigest}).`,
    );
  }
}

function validateCellValue(value: unknown, label: string): void {
  if (value !== null && typeof value !== "string" && typeof value !== "boolean"
    && !(typeof value === "number" && Number.isFinite(value))) {
    throw new SpreadsheetRuntimeError(`${label} must be a finite scalar spreadsheet value.`);
  }
}

function requirePositiveInteger(value: number | undefined, label: string): void {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new SpreadsheetRuntimeError(`${label} must be a positive integer.`);
  }
}

function requireText(value: string, label: string): void {
  if (value.trim() === "") throw new SpreadsheetRuntimeError(`${label} must not be empty.`);
}

function requireDigest(value: string, label: string): void {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new SpreadsheetRuntimeError(`${label} must be a SHA-256 digest.`);
}

async function requireRegularFile(path: string, label: string): Promise<string> {
  await access(path).catch(() => {
    throw new SpreadsheetRuntimeError(`${label} does not exist: ${path}`);
  });
  const resolved = await realpath(path);
  const metadata = await lstat(resolved);
  if (!metadata.isFile()) throw new SpreadsheetRuntimeError(`${label} is not a regular file: ${path}`);
  return resolved;
}

async function requireDirectory(path: string, label: string): Promise<string> {
  await access(path).catch(() => {
    throw new SpreadsheetRuntimeError(`${label} does not exist: ${path}`);
  });
  const resolved = await realpath(path);
  const metadata = await lstat(resolved);
  if (!metadata.isDirectory()) throw new SpreadsheetRuntimeError(`${label} is not a directory: ${path}`);
  return resolved;
}

function sha256(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const BRIDGE_SOURCE = String.raw`
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
    const matches = semanticMatches(initialSheets, mutation, request.maxCellsPerSheet);
    let selected;
    if (mutation.occurrence === undefined) {
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
