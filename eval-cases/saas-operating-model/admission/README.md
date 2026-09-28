# SaaS operating model admission

The existing `admission-receipt.json` records the historical Node 24.19.0 and `@oai/artifact-tool` 2.8.52 portfolio. It remains available as historical evidence and does not qualify the current runtime candidate.

The current admission runner pins Node 24.19.0 and `@oai/artifact-tool` 2.8.59 by executable bytes, package entrypoint bytes, and a digest of the complete package tree. It calls the production `preflightSpreadsheetRuntime` authority before candidate execution and again at the end. It records source and built `dist` digests before and after, uses an exact per-candidate predicate signature, retains each check vector, and verifies the full scenario roster. Run it on macOS Apple Silicon after building the eval-runner package:

```sh
RELAYER_SPREADSHEET_NODE=/Users/vishal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
RELAYER_SPREADSHEET_NODE_MODULES=/Users/vishal/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
RELAYER_SPREADSHEET_ADMISSION_ROOT=/Volumes/2T-SSD/eval-evidence/2026-09-27/saas-operating-model-run \
node eval-cases/saas-operating-model/admission/run-admission.mjs
```

The admission root must be an absolute path that is new or empty. Omitting it writes beneath the case's timestamped evidence directory.

Each run writes a new versioned evidence directory with the untouched red baseline, both green variants, targeted mutants, each predicate receipt, command logs, workbook digests, and render digests. Failed workspaces are retained for diagnosis. The runner binds all 36 check names and requires an exact per-candidate failed-check set plus passing workbook rendering, delivery, and clean-workspace prerequisites for semantic mutants. Its pure outcome classifier rejects missing, duplicate, unknown, and undeclared failed predicates; the focused regression also verifies that an unrelated extra semantic failure prevents admission.

The initial Node 24.19.0 / artifact-tool 2.8.59 diagnostic receipts are preserved outside the source tree under `/Volumes/2T-SSD/eval-evidence/2026-09-27/worker-candidate-audit/saas-diagnostic/`. Their exact baseline and mutant signatures informed the checked-in classifier: the baseline signature includes missing sources and rows, historical outputs, scenario outputs and distinctness, runway keys, required formulas, dashboard/visible checks, rendering/chart evidence, input-response, required delivery, and commit; `delivery-clean` and checks whose empty-workbook branch has no mismatch pass. `mutant-hardcoded` fails required formula outputs and dashboard values; `mutant-omitted-source` fails payment IDs/rows, February collections reconciliation, and formula cell references; `mutant-same-scenarios` fails material distinctness and independent scenario values. The runner never overwrites the 2.8.52 receipt and reports deterministic admission only; it does not claim promotion or adversarial certification.
