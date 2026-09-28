export declare const SPREADSHEET_RUNTIME_SOURCE_SHA256 = "5ecc2435a8dccd96131f48e9fa1cd8f439955951e99cc44922fef7aed1004497";
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
    readonly artifactToolContentDigest: `sha256:${string}`;
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
export interface SpreadsheetLabelValueMutation {
    readonly kind: "label-value";
    readonly sheetName?: string;
    readonly labels: readonly string[];
    readonly value: SpreadsheetCellValue;
}
export type SpreadsheetSemanticMutation = SpreadsheetTableCellMutation | SpreadsheetLabelValueMutation;
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
export declare class SpreadsheetRuntimeError extends Error {
    readonly detail: string;
    constructor(message: string, detail?: string);
}
export declare function inspectSpreadsheetWorkbook(options: InspectSpreadsheetWorkbookOptions): Promise<SpreadsheetWorkbookReceipt>;
export declare function preflightSpreadsheetRuntime(runtime: SpreadsheetRuntimeConfig): Promise<{
    readonly available: true;
} | {
    readonly available: false;
    readonly reason: string;
}>;
