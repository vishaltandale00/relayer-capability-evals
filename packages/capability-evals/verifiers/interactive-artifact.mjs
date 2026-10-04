import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function gradeInteractiveArtifact({ workspaceDirectory }) {
  let text = "";
  try { text = await readFile(join(workspaceDirectory, "deliverable.md"), "utf8"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return [{ name: "interactive-artifact", passed: text.trim().length > 0,
    detail: "Artifact presence only. Current research, graph decisions, personal fit and reservation evidence require human review." }];
}
