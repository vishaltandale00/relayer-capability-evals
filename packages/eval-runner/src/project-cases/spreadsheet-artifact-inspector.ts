import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

export interface SpreadsheetRuntimePaths {
  readonly nodeModulesDirectory: string;
  readonly nodeExecutable: string;
}
export interface WorkbookCellSnapshot { readonly value: unknown; readonly formula: string; readonly sheet: string; readonly row: number; readonly column: number }
export interface WorkbookInspection { readonly sheets: readonly { readonly name: string; readonly cells: readonly WorkbookCellSnapshot[]; readonly renderBytes: number; readonly renderDigest?: string; readonly drawingCount: number; readonly chartSeriesFormulaCount?: number; readonly chartSeriesFormulas?: readonly { readonly formula: string; readonly categoryFormula: string }[] }[] }
export interface WorkbookInspector {
  inspect(workbookPath: string): Promise<WorkbookInspection>;
  mutateAndInspect(workbookPath: string, mutations: readonly { sheet: string; row: number; column: number; value: number | string }[]): Promise<WorkbookInspection>;
}
export const SPREADSHEET_RUNTIME_CONTENT_DIGEST = "sha256:28c392600c89ee2257af628d1aecf5c57b6574c7a6c5e4ea18f3867c9de282c2";
export const SPREADSHEET_NODE_CONTENT_DIGEST = "sha256:27db838bb204ef7c21df2931f5656e4c8fb32e6e947f363a402b49714d32b5b1";

export async function spreadsheetRuntimeContentDigest(directory: string): Promise<string> {
  const entries: string[] = [];
  const digest = (value: Uint8Array | string) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
  const visit = async (current: string, relative = "") => { for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) { const child = join(current, entry.name); const name = join(relative, entry.name); if (entry.isDirectory()) await visit(child, name); else if (entry.isFile()) entries.push(`${name}\0${digest(await readFile(child))}`); } };
  await visit(directory); return digest(entries.join("\n"));
}
export async function assertSpreadsheetRuntime(runtime: SpreadsheetRuntimePaths, expectedDigest = SPREADSHEET_RUNTIME_CONTENT_DIGEST, expectedNodeDigest = SPREADSHEET_NODE_CONTENT_DIGEST): Promise<void> {
  const actual = await spreadsheetRuntimeContentDigest(join(runtime.nodeModulesDirectory, "@oai", "artifact-tool"));
  if (actual !== expectedDigest) throw new Error(`Spreadsheet runtime content digest mismatch: ${actual}.`);
  const nodeDigest = `sha256:${createHash("sha256").update(await readFile(runtime.nodeExecutable)).digest("hex")}`;
  if (nodeDigest !== expectedNodeDigest) throw new Error(`Spreadsheet Node content digest mismatch: ${nodeDigest}.`);
}

const execFileAsync = promisify(execFile);

const bridgeSource = `
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const [mode, workbookPath, mutationsPath, outputPath] = process.argv.slice(2);
async function load(path) { return SpreadsheetFile.importXlsx(await FileBlob.load(path)); }
async function inspect(workbook, renderSheets) {
  const sheets = [];
  for (const sheet of workbook.worksheets.items) {
    const used = sheet.getUsedRange();
    const values = used ? used.values : [];
    const formulas = used ? used.formulas : [];
    const cells = [];
    for (let row = 0; row < values.length; row += 1) for (let column = 0; column < (values[row]?.length || 0); column += 1) {
      const value = values[row][column]; const formula = formulas[row]?.[column] || "";
      if (value !== null && value !== "" || formula) cells.push({ value, formula, sheet: sheet.name, row, column });
    }
    const rendered = renderSheets ? new Uint8Array(await (await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" })).arrayBuffer()) : new Uint8Array();
    const renderBytes = rendered.byteLength; const renderDigest = renderSheets ? "sha256:" + createHash("sha256").update(rendered).digest("hex") : "";
    const drawingCount = (sheet.charts?.items?.length || 0) + (sheet.images?.items?.length || 0) + (sheet.shapes?.items?.length || 0);
    const chartSeriesFormulas = (sheet.charts?.items || []).flatMap((chart) => chart.series?.items || []).map((series) => ({ formula: series.formula || "", categoryFormula: series.categoryFormula || "" }));
    const chartSeriesFormulaCount = chartSeriesFormulas.filter((series) => series.formula && series.categoryFormula).length;
    sheets.push({ name: sheet.name, cells, renderBytes, renderDigest, drawingCount, chartSeriesFormulaCount, chartSeriesFormulas });
  }
  return { sheets };
}
let workbook = await load(workbookPath);
if (mode === "mutate") {
  const mutations = JSON.parse(await fs.readFile(mutationsPath, "utf8"));
  for (const mutation of mutations) workbook.worksheets.getItem(mutation.sheet).getCell(mutation.row, mutation.column).values = [[mutation.value]];
  const exported = await SpreadsheetFile.exportXlsx(workbook); await exported.save(outputPath); workbook = await load(outputPath);
}
process.stdout.write(JSON.stringify(await inspect(workbook, mode === "inspect")));
`;

export class ArtifactToolWorkbookInspector implements WorkbookInspector {
  constructor(private readonly runtime: SpreadsheetRuntimePaths) {}

  inspect(workbookPath: string): Promise<WorkbookInspection> {
    return this.#run("inspect", workbookPath, []);
  }

  mutateAndInspect(workbookPath: string, mutations: readonly { sheet: string; row: number; column: number; value: number | string }[]): Promise<WorkbookInspection> {
    return this.#run("mutate", workbookPath, mutations);
  }

  async #run(mode: "inspect" | "mutate", workbookPath: string, mutations: readonly unknown[]): Promise<WorkbookInspection> {
    await assertSpreadsheetRuntime(this.runtime);
    const directory = await mkdtemp(join(tmpdir(), "relayer-spreadsheet-inspector-"));
    try {
      await symlink(this.runtime.nodeModulesDirectory, join(directory, "node_modules"), "dir");
      await writeFile(join(directory, "bridge.mjs"), bridgeSource, "utf8");
      await writeFile(join(directory, "mutations.json"), JSON.stringify(mutations), "utf8");
      await copyFile(workbookPath, join(directory, "input.xlsx"));
      const { stdout } = await execFileAsync(this.runtime.nodeExecutable, [join(directory, "bridge.mjs"), mode, join(directory, "input.xlsx"), join(directory, "mutations.json"), join(directory, "mutated.xlsx")], { cwd: directory, maxBuffer: 32 * 1024 * 1024 });
      const jsonStart = stdout.lastIndexOf('{"sheets"');
      if (jsonStart < 0) throw new Error(`Spreadsheet inspector returned no workbook snapshot: ${stdout.slice(0, 500)}`);
      return JSON.parse(stdout.slice(jsonStart)) as WorkbookInspection;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

export function spreadsheetRuntimeFromEnvironment(environment: NodeJS.ProcessEnv = process.env): SpreadsheetRuntimePaths {
  const nodeExecutable = environment.RELAYER_SPREADSHEET_NODE;
  const nodeModulesDirectory = environment.RELAYER_SPREADSHEET_NODE_MODULES;
  if (!nodeExecutable || !nodeModulesDirectory) {
    throw new Error("SaaS spreadsheet evaluation requires RELAYER_SPREADSHEET_NODE and RELAYER_SPREADSHEET_NODE_MODULES.");
  }
  return Object.freeze({ nodeExecutable, nodeModulesDirectory });
}

export function spreadsheetInspectorVerifierSource(): string {
  return [bridgeSource, ArtifactToolWorkbookInspector.toString(), spreadsheetRuntimeFromEnvironment.toString(), spreadsheetRuntimeContentDigest.toString(), assertSpreadsheetRuntime.toString(), SPREADSHEET_RUNTIME_CONTENT_DIGEST, SPREADSHEET_NODE_CONTENT_DIGEST].join("\n");
}
