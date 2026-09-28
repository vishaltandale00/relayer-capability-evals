function deepFreeze(value) {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export const JUPYTERLAB_ADMISSION_CHECK_ROSTER = deepFreeze([
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

const allBehaviorChecks = JUPYTERLAB_ADMISSION_CHECK_ROSTER.filter((name) =>
  name.startsWith("workspace:bundle-"),
);
export const JUPYTERLAB_ADMISSION_PORTFOLIO = deepFreeze([
  {
    id: "untouched-baseline",
    role: "delivery-ineligible-red-baseline",
    patch: null,
    noCommit: true,
    expectedFailedChecks: JUPYTERLAB_ADMISSION_CHECK_ROSTER.filter(
      (name) => name !== "workspace:implementation-clean",
    ),
  },
  {
    id: "missing-feature-control",
    role: "delivery-eligible-red-control",
    patch: null,
    createMissingFeature: true,
    expectedFailedChecks: [
      "workspace:focused-upstream-tests",
      "workspace:sealed-public-export",
      ...allBehaviorChecks,
    ],
  },
  {
    id: "green-recursive",
    role: "green-solution",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
    expectedFailedChecks: [],
  },
  {
    id: "green-normalized",
    role: "green-solution",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-normalized.patch",
    expectedFailedChecks: [],
  },
  {
    id: "mutant-omits-executions",
    role: "semantic-mutant",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
    expectedFailedChecks: [
      "workspace:bundle-bundle-integrity",
      "workspace:bundle-tamper-detection",
    ],
    replace: [
      "return digest(canonical(value));",
      "return digest(canonical({ ...value, executions: [] }));",
    ],
  },
  {
    id: "mutant-accepts-missing",
    role: "authority-mutant",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
    expectedFailedChecks: ["workspace:bundle-missing-inputs"],
    replace: ["if (missingInputs.length > 0)", "if (missingInputs.length < 0)"],
  },
  {
    id: "mutant-hides-partial",
    role: "semantic-mutant",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
    expectedFailedChecks: ["workspace:bundle-partial-execution"],
    replace: [
      "bundle.executions.some(item => item.state !== 'completed') ? 'partial' : 'verified'",
      "'verified'",
    ],
  },
  {
    id: "mutant-detached-ui",
    role: "semantic-mutant",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
    expectedFailedChecks: [
      "workspace:focused-upstream-tests",
      "workspace:bundle-ui-status",
    ],
    replace: ["host.appendChild(node);", ""],
  },
  {
    id: "mutant-protected-config",
    role: "protected-authority-mutant",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
    protectedConfigMutation: {
      path: ".yarnrc.yml",
      append: "tampered: true\n",
    },
  },
  {
    id: "mutant-post-test-delta",
    role: "delta-authority-mutant",
    patch:
      "eval-cases/jupyterlab-execution-bundles/solution/green-recursive.patch",
    postTestDelta: true,
    postTestMutationPath: "../src/executionbundle.ts",
    expectedFailedChecks: ["workspace:pristine-verification-integrity"],
  },
]);

export function sameOrderedValues(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}
