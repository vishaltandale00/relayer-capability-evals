# GraphComplete capability suite completion

Coordination snapshot: 2026-09-27. This file is a work plan, not a passing receipt.

## Scope and source

Implement GitHub issue #278 for `relayer-graphcomplete`. Preserve source provenance from
`relayer-capability-evals` commit `4d8f4aeb5c9675805d204a1fbc3418bf8b4671a7`
through the saved import commit `10852068089972217a9ac01dfda77af75200f146`.
The first integration target is main commit `dc0c2039791cb25558958ac78cc6b4472a730903`.
PR #533 subsequently reconciles main `b8390ca25b3a73c586136bf6a2438ab95159b2e9`.
Affected source bindings and portfolios were refreshed; subsequent upstream
changes require explicit reconciliation and fresh applicable verification.

## Work allocation

- GPT-5.6 Sol: reconcile the import with the pinned current-main snapshot.
- GPT-5.6 Sol: implement the immutable `harness-capability-pilot-v1` manifest,
  resolution, catalog projection, selection, and persisted identities.
- GPT-6 Luna: audit candidates and repair Emergency runtime/dependency authority.
- Coordinating agent: review checkpoint mappings, integrate changes, coordinate
  heavy verification, and preserve exact source/evidence identities.

## Required verification

1. Preserve existing graph, recursive execution, review, runtime availability,
   and independent outcome/presentation contracts through the merge.
2. Verify ordered exact membership, immutable expected snapshot/contract pins,
   deterministic suite identity, fail-closed drift and unavailable members,
   ordinary case-by-harness expansion, safe catalog output, and durable receipts.
3. Authenticate Emergency's frozen standalone Node bytes before execution;
   reject invalid dependency trees before launching candidate code; retain
   independently attributable failure predicates.
4. Run focused production-seam tests while editing. Run repository `npm run check`
   and `npm run build` before committing. Run existing named case-specific heavy
   portfolios in their declared environments before claiming their admission.
5. Re-admit prior source-admitted cases against the final combined snapshot.
   Finish Excalidraw/JupyterLab and spreadsheet candidate evidence separately.
6. Obtain adversarial review of the exact final source state. Without a PR,
   reviews are non-certifying handoff evidence.
7. Prepare a concrete live-run configuration and cost cap after deterministic
   readiness. Paid inference requires separate explicit authorization.

## Current evidence frontier

All ten deterministic portfolios passed. The aggregate `ADMISSION_INDEX.json`
binds the final ordered suite to versioned receipts and scoped source reviews.
Planner's final thirteen-entry portfolio and SaaS's final six-entry replay both
passed with stable inputs against the same frozen compiled runner. Excalidraw's
thirteen-entry portfolio includes two independent controller implementations.
A fresh byte audit verifies every captured input for reused scoped receipts.

These observations qualify verifier discrimination within the declared scope.
They do not establish a paid live baseline or change candidate authoring status.
Failures, interrupted attempts, superseded reviews, and known authority limits
remain recorded in the chronological checkpoint ledger.

## Required remaining handoff gates

1. Freeze the source and evidence, then run full `RUST_TEST_THREADS=1 VITEST_MAX_WORKERS=1 npm run check`
   and `npm run build`. Serial Rust and Vitest test execution limits load without
   omitting tests, weakening assertions, or enlarging timeouts.
2. Run the PRD-required `npm run test:eval-compiled-runtime` and the real
   configured Eval browser proof with all-ten availability required.
3. Recheck captured source/compiled input hashes and exact-source review scopes.
4. Record gate results against the tested snapshot in the draft pull request.
5. A live baseline remains blocked on the missing ordinary-suite confirmation,
   credential-reference, and declared cost-cap contract. Settle cap semantics,
   implement and verify that seam, and obtain authorization for the concrete
   harness/model/judge configuration. See `LIVE_BASELINE_READINESS.md`.

## Evidence already obtained

`CHECKPOINTS.md` records exact paths and hashes, including unsuccessful attempts.
The frozen snapshot
`35f189706a95186a0b7935bad118ee2f15c4ee362b2057f257b847168e45ee85`
passed complete `VITEST_MAX_WORKERS=1 npm run check` (2509 Vitest tests passed,
17 skipped) and `npm run build`. The first full-check attempt on that snapshot
failed two timing-sensitive tests under host contention; unchanged focused runs
and the complete serial retry passed. Subsequent repairs invalidate a claim that
those gates certify the final workspace.

A prior full-check failure also exposed a real Node Detail disposal race. The
production guard and asynchronous test observation were repaired, with a red
regression before the fix and 74/74 focused tests afterward. Scoped independent
review and logs are in the checkpoint ledger.

All reviews remain non-certifying without a PR and apply only to their recorded
source digest. No paid live run has been performed, no accepted baseline exists,
and missing or undefined heavy proof remains indeterminate.
