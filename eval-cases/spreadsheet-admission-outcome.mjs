import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export function checksMatchExpectedOutcome(checks, { expectedNames, expectedFailures, prerequisites = [] }) {
  if (!Array.isArray(checks) || !Array.isArray(expectedNames) || !Array.isArray(expectedFailures) || !Array.isArray(prerequisites)) return false;
  if (!checks.every((check) => typeof check?.name === "string" && typeof check.passed === "boolean" && typeof check.detail === "string")) return false;
  const names = checks.map(({ name }) => name);
  if (new Set(names).size !== names.length || names.length !== expectedNames.length) return false;
  const expectedNameSet = new Set(expectedNames);
  if (expectedNameSet.size !== expectedNames.length || names.some((name) => !expectedNameSet.has(name))) return false;
  const byName = new Map(checks.map((check) => [check.name, check]));
  if (prerequisites.some((name) => byName.get(name)?.passed !== true)) return false;
  const actualFailures = checks.filter(({ passed }) => !passed).map(({ name }) => name).sort();
  return JSON.stringify(actualFailures) === JSON.stringify([...expectedFailures].sort());
}

export async function digestDirectory(directory) {
  const entries = [];
  async function visit(current, relative = "") {
    for (const entry of (await fs.readdir(current, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const child = path.join(current, entry.name);
      const name = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Source tree contains a symbolic link: ${name}`);
      if (entry.isDirectory()) await visit(child, name);
      else if (entry.isFile()) entries.push(`${name}\0sha256:${createHash("sha256").update(await fs.readFile(child)).digest("hex")}`);
    }
  }
  await visit(directory);
  return `sha256:${createHash("sha256").update(entries.join("\n")).digest("hex")}`;
}

export async function prepareEmptyOutputRoot(directory) {
  if (!path.isAbsolute(directory)) throw new Error("Admission output root must be an absolute path.");
  try {
    const entries = await fs.readdir(directory);
    if (entries.length > 0) throw new Error(`Admission output root must be new or empty: ${directory}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Admission output root must be new or empty:")) throw error;
    if (error?.code !== "ENOENT") throw error;
    await fs.mkdir(directory, { recursive: true });
  }
  return directory;
}
