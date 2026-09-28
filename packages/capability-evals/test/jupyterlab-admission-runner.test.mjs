import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  JUPYTERLAB_ADMISSION_CHECK_ROSTER,
  JUPYTERLAB_ADMISSION_PORTFOLIO,
} from "../../../scripts/lib/jupyterlab-admission-contract.mjs";

const patchPath = new URL(
  "../../../eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
  import.meta.url,
);

function addedFile(patch, path) {
  const start = patch.indexOf(`diff --git a/${path} b/${path}`);
  if (start < 0) throw new Error(`missing ${path}`);
  const tail = patch.slice(start);
  const end = tail.indexOf("\ndiff --git ", 1);
  return (end < 0 ? tail : tail.slice(0, end))
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
    .map((line) => line.slice(1))
    .join("\n");
}

describe("JupyterLab admission mutations", () => {
  it("declares the complete grader roster and an exact outcome for every portfolio entry", () => {
    expect(JUPYTERLAB_ADMISSION_CHECK_ROSTER).toEqual([
      "workspace:implementation-build",
      "workspace:focused-upstream-tests",
      "workspace:sealed-public-export",
      "workspace:bundle-public-api",
      "workspace:bundle-environment-identity",
      "workspace:bundle-ordered-execution-evidence",
      "workspace:bundle-output-preservation",
      "workspace:bundle-referenced-file-integrity",
      "workspace:bundle-bundle-integrity",
      "workspace:bundle-read-only-import",
      "workspace:bundle-rerun-comparison",
      "workspace:bundle-missing-inputs",
      "workspace:bundle-tamper-detection",
      "workspace:bundle-partial-execution",
      "workspace:bundle-ui-status",
      "workspace:pristine-verification-integrity",
      "workspace:meaningful-commit",
      "workspace:implementation-clean",
    ]);
    expect(new Set(JUPYTERLAB_ADMISSION_CHECK_ROSTER).size).toBe(
      JUPYTERLAB_ADMISSION_CHECK_ROSTER.length,
    );

    for (const entry of JUPYTERLAB_ADMISSION_PORTFOLIO) {
      expect(
        entry.expectedFailedChecks !== undefined ||
          entry.protectedConfigMutation !== undefined,
      ).toBe(true);
      for (const check of entry.expectedFailedChecks ?? []) {
        expect(JUPYTERLAB_ADMISSION_CHECK_ROSTER).toContain(check);
      }
    }

    expect(
      JUPYTERLAB_ADMISSION_PORTFOLIO.map(
        ({ id, expectedFailedChecks = [], protectedConfigMutation }) => ({
          id,
          expectedFailedChecks,
          protectedConfigMutation,
        }),
      ),
    ).toEqual([
      {
        id: "untouched-baseline",
        expectedFailedChecks: JUPYTERLAB_ADMISSION_CHECK_ROSTER.slice(0, -1),
        protectedConfigMutation: undefined,
      },
      {
        id: "missing-feature-control",
        expectedFailedChecks: JUPYTERLAB_ADMISSION_CHECK_ROSTER.slice(1, 15),
        protectedConfigMutation: undefined,
      },
      {
        id: "green-recursive",
        expectedFailedChecks: [],
        protectedConfigMutation: undefined,
      },
      {
        id: "green-normalized",
        expectedFailedChecks: [],
        protectedConfigMutation: undefined,
      },
      {
        id: "mutant-omits-executions",
        expectedFailedChecks: [
          "workspace:bundle-bundle-integrity",
          "workspace:bundle-tamper-detection",
        ],
        protectedConfigMutation: undefined,
      },
      {
        id: "mutant-accepts-missing",
        expectedFailedChecks: ["workspace:bundle-missing-inputs"],
        protectedConfigMutation: undefined,
      },
      {
        id: "mutant-hides-partial",
        expectedFailedChecks: ["workspace:bundle-partial-execution"],
        protectedConfigMutation: undefined,
      },
      {
        id: "mutant-detached-ui",
        expectedFailedChecks: [
          "workspace:focused-upstream-tests",
          "workspace:bundle-ui-status",
        ],
        protectedConfigMutation: undefined,
      },
      {
        id: "mutant-protected-config",
        expectedFailedChecks: [],
        protectedConfigMutation: {
          path: ".yarnrc.yml",
          append: "tampered: true\n",
        },
      },
      {
        id: "mutant-post-test-delta",
        expectedFailedChecks: ["workspace:pristine-verification-integrity"],
        protectedConfigMutation: undefined,
      },
    ]);
  });

  it("applies every semantic mutation to exactly one seam in the sealed recursive green", async () => {
    const patch = await readFile(patchPath, "utf8");
    const implementation = addedFile(
      patch,
      "packages/notebook/src/executionbundle.ts",
    );
    const mutations = [
      [
        "return digest(canonical(value));",
        "return digest(canonical({ ...value, executions: [] }));",
      ],
      ["if (missingInputs.length > 0)", "if (missingInputs.length < 0)"],
      [
        "bundle.executions.some(item => item.state !== 'completed') ? 'partial' : 'verified'",
        "'verified'",
      ],
      ["host.appendChild(node);", ""],
    ];
    for (const [anchor, replacement] of mutations) {
      expect(implementation.split(anchor)).toHaveLength(2);
      expect(implementation.replace(anchor, replacement)).not.toBe(
        implementation,
      );
    }
  });

  it("has exact protected-config and post-test-delta mutation targets", async () => {
    const patch = await readFile(patchPath, "utf8");
    const testSource = addedFile(
      patch,
      "packages/notebook/test/executionbundle.spec.ts",
    );
    expect(testSource).toContain("describe('execution bundles'");
    const mutated = `import { appendFileSync } from 'node:fs';\n${testSource}\nafterAll(() => appendFileSync('packages/notebook/src/executionbundle.ts', '// mutation'));`;
    expect(mutated).not.toBe(testSource);
    const runner = await readFile(
      new URL(
        "../../../scripts/verify-jupyterlab-execution-bundles-admission.mjs",
        import.meta.url,
      ),
      "utf8",
    );
    expect(runner).toContain("entry.protectedConfigMutation.path");
    expect(runner).toContain(
      "graderError === protectedConfigMutation?.expectedError",
    );
    expect(runner).toContain("candidate post-test mutation");
    expect(runner).toContain("sourceInputsBefore");
    expect(runner).toContain("sourceInputsAfter");
    expect(runner).toContain("normalizedSourceDigest");
    expect(runner).toContain('status: "started"');
  });
});
