# Production delivery planner admission

`../admission-manifest-2.8.52-historical.json` preserves the previous candidate identity and its old 2.8.52 portfolio declaration. It is historical and cannot be reused for the current runtime candidate.

The current admission runner pins Node 24.19.0 and `@oai/artifact-tool` 2.8.59 by executable digest, package entrypoint digest, and full package-tree digest. It authenticates the complete environment before invoking Node, then creates a fresh retained workspace for the untouched red baseline, two materially different formula-driven greens, and ten targeted mutants. The production verifier independently imports, recalculates, renders, and mutates the actual workbooks; the runner preserves every workspace, per-predicate receipt, command log, and workbook digest, including failures.

Run on macOS Apple Silicon after building the eval-runner package:

```sh
RELAYER_SPREADSHEET_NODE=/Users/vishal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
RELAYER_SPREADSHEET_NODE_MODULES=/Users/vishal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
RELAYER_SPREADSHEET_ADMISSION_ROOT=/Volumes/2T-SSD/eval-evidence/2026-09-27/production-delivery-planner-run \
node eval-cases/production-delivery-planner/admission/run-admission.mjs
```

The admission root must be an absolute path that is new or empty. Omitting it writes beneath the case's timestamped evidence directory. The runner hashes source and built `dist` inputs before and after execution, records production-preflight results at both boundaries, retains command output and each full predicate vector per entry, stops after an unexpected result, and checks that the complete declared roster finished.

The resulting receipt is deterministic admission evidence only. It does not promote the case or certify the verifier without an exact-source adversarial review.
