import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checksMatchExpectedOutcome, prepareEmptyOutputRoot } from "../../../eval-cases/spreadsheet-admission-outcome.mjs";

const names = ["workspace:runtime-identity", "workspace:workbook-parse", "workspace:semantic-target", "workspace:delivery-clean"];
const checks = [
  { name: names[0], passed: true, detail: "authenticated" },
  { name: names[1], passed: true, detail: "parsed" },
  { name: names[2], passed: false, detail: "targeted defect" },
  { name: names[3], passed: true, detail: "clean" },
];

describe("spreadsheet admission result boundaries", () => {
  it("admits only the exact expected semantic failure with passing prerequisites", () => {
    expect(checksMatchExpectedOutcome(checks, {
      expectedNames: names,
      expectedFailures: ["workspace:semantic-target"],
      prerequisites: ["workspace:runtime-identity", "workspace:workbook-parse", "workspace:delivery-clean"],
    })).toBe(true);
  });

  it("rejects an unrelated semantic failure even when the declared target also fails", () => {
    expect(checksMatchExpectedOutcome([...checks, { name: "workspace:unrelated-semantic-check", passed: false, detail: "unexpected" }], {
      expectedNames: names,
      expectedFailures: ["workspace:semantic-target"],
    })).toBe(false);
  });

  it("does not admit an all-failed transport when runtime authentication failed", () => {
    const failed = checks.map((check) => ({ ...check, passed: false }));
    expect(checksMatchExpectedOutcome(failed, {
      expectedNames: names,
      expectedFailures: names,
      prerequisites: ["workspace:runtime-identity"],
    })).toBe(false);
  });

  it("accepts a new output root and refuses an existing non-empty root", async () => {
    const root = await mkdtemp(join(tmpdir(), "spreadsheet-admission-root-"));
    const output = join(root, "run");
    try {
      await expect(prepareEmptyOutputRoot(output)).resolves.toBe(output);
      await writeFile(join(output, "evidence.txt"), "preserve");
      await expect(prepareEmptyOutputRoot(output)).rejects.toThrow("must be new or empty");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    { checks: [...checks, checks[2]] },
    { checks: checks.slice(1) },
    { checks: checks.map((check, index) => index === 2 ? { ...check, name: "workspace:unknown-predicate-transport" } : check) },
  ])("rejects duplicate, missing, or unknown transported checks", ({ checks: candidate }) => {
    expect(checksMatchExpectedOutcome(candidate, {
      expectedNames: names,
      expectedFailures: ["workspace:semantic-target"],
    })).toBe(false);
  });
});
