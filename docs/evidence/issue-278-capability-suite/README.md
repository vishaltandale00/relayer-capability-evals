# Capability suite evidence

The current deterministic result is [ADMISSION_INDEX.json](ADMISSION_INDEX.json).
It binds the ordered ten-case suite to case/verifier identities, passing
portfolio receipts, and scoped reviews. [Final input audit](final-portfolios-input-audit.json)
checks all 99 captured source and compiled inputs against this integration.

The [plan](PLAN.md) separates required verification from evidence. The
[checkpoint ledger](CHECKPOINTS.md) preserves failed attempts, source changes,
and superseded results. Final full check, build, compiled-runtime and browser
results are recorded against the frozen source in [draft PR #533](https://github.com/vishaltandale00/relayer-graphcomplete/pull/533).

This is deterministic verifier qualification, not a live model-performance or
release result. Candidate status remains explicit. The [live-readiness note](LIVE_BASELINE_READINESS.md)
records the missing confirmation, credential-reference and declared-cap contract;
no paid baseline has run or been accepted.
