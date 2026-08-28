import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [workbookPath, outputDirectory] = process.argv.slice(2);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
for (const sheetName of workbook.worksheets.items.map((sheet) => sheet.name)) {
  const render = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDirectory}/${sheetName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.png`, new Uint8Array(await render.arrayBuffer()));
}
