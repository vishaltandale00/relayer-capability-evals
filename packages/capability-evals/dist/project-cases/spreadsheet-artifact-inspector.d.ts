export interface SpreadsheetRuntimePaths {
    readonly nodeModulesDirectory: string;
    readonly nodeExecutable: string;
}
export interface WorkbookCellSnapshot {
    readonly value: unknown;
    readonly formula: string;
    readonly sheet: string;
    readonly row: number;
    readonly column: number;
}
export interface WorkbookInspection {
    readonly sheets: readonly {
        readonly name: string;
        readonly cells: readonly WorkbookCellSnapshot[];
        readonly renderBytes: number;
        readonly renderDigest?: string;
        readonly drawingCount: number;
        readonly chartSeriesFormulaCount?: number;
        readonly chartSeriesFormulas?: readonly {
            readonly formula: string;
            readonly categoryFormula: string;
        }[];
    }[];
}
export interface WorkbookInspector {
    inspect(workbookPath: string): Promise<WorkbookInspection>;
    mutateAndInspect(workbookPath: string, mutations: readonly {
        sheet: string;
        row: number;
        column: number;
        value: number | string;
    }[]): Promise<WorkbookInspection>;
}
export declare const SPREADSHEET_RUNTIME_CONTENT_DIGEST = "sha256:eb3c0b54042c490c79837b4cd093028f34f2199e22236977ddbba6ec0482924c";
export declare const SPREADSHEET_NODE_CONTENT_DIGEST = "sha256:27db838bb204ef7c21df2931f5656e4c8fb32e6e947f363a402b49714d32b5b1";
export declare const SPREADSHEET_ARTIFACT_INSPECTOR_SOURCE_SHA256 = "bdb398e5bcd9c45a556773ed921d03942c1dfd5a8becd650d58a0ad7f92028e6";
export declare function spreadsheetRuntimeContentDigest(directory: string): Promise<string>;
export declare function assertSpreadsheetRuntime(runtime: SpreadsheetRuntimePaths, expectedDigest?: string, expectedNodeDigest?: string): Promise<void>;
export declare class ArtifactToolWorkbookInspector implements WorkbookInspector {
    #private;
    private readonly runtime;
    constructor(runtime: SpreadsheetRuntimePaths);
    inspect(workbookPath: string): Promise<WorkbookInspection>;
    mutateAndInspect(workbookPath: string, mutations: readonly {
        sheet: string;
        row: number;
        column: number;
        value: number | string;
    }[]): Promise<WorkbookInspection>;
}
export declare function spreadsheetRuntimeFromEnvironment(environment?: NodeJS.ProcessEnv): SpreadsheetRuntimePaths;
export declare function spreadsheetInspectorVerifierSource(): string;
