# Harness capability live-baseline readiness

Prepared read-only from the frozen integration checkout on 2026-09-27. No inference was run and no credential value was read.

## Supported run selection

The first ten-case run uses the ordinary Relayer Eval `createRun` selection:

```json
{
  "suiteId": "harness-capability-pilot-v1",
  "testCaseIds": [],
  "harnessConfigurationNames": ["codex-basic"],
  "judgeConfigurationName": "simulated-user-sol-high"
}
```

`testCaseIds` must be absent or empty when `suiteId` is present; callers cannot override or shrink the suite membership. The service resolves the fixed ten members before creating the run and expands them through the ordinary case × harness matrix. One harness therefore creates ten executions. The supported development catalog includes `codex-basic`; it is a `codex.basic` harness with `agentAuthored: true`, Codex-compatible provider selection, medium reasoning, workspace-write/on-request Auto permissions, network enabled, and the layered-navigation multi-agent prompt profile. The model is not a `createRun` field: it is resolved from the connected provider catalog and the harness family policy. Record the resolved provider/model from the created executions before treating the baseline as fixed.

The current local simulated-user runner is pinned in code to `gpt-5.6-sol` with high reasoning. Both `simulated-user` and `simulated-user-sol-high` route through that runner today; `simulated-user-sol-high` states the actual choice clearly. The suite’s immutable presentation contract remains the authority for rubric, prompt, tools, and graph policy.

Relevant seams: `desktop/eval-renderer/configuration-model.js`, `desktop/eval-main/eval-service.mjs#createRun`, `desktop/eval-main/configuration-paths.mjs`, `harnesses/codex-basic.yaml`, and `desktop/eval-main/simulated-user-judge.mjs`.

## Credentials and environment

The candidate harness and simulated-user judge both require an available managed Codex runtime backed by the connected product provider. The public credential reference used by live authorization contracts is the opaque literal `connected-product-provider`; no secret belongs in a run selection or artifact. The suite path itself currently does **not** require or persist a `liveAuthorization` object, so it does not yet validate this reference before creating an ordinary suite run.

Before launch, the operator must:

1. Use an isolated `RELAYER_EVAL_USER_DATA_DIR` and connect/login the intended Codex account through the managed product provider.
2. Confirm model discovery returns the intended available model and record that resolved identity. `codex-basic` otherwise accepts any compatible visible Codex model selected by its family policy.
3. Supply the already-qualified absolute spreadsheet runtime pair (`RELAYER_SPREADSHEET_NODE` and `RELAYER_SPREADSHEET_NODE_MODULES`) and the declared Emergency Node runtime so all ten suite members remain available. Run on the supported local Mac target; project cases fail closed elsewhere.
4. Recheck the catalog shows **Harness capability pilot v1**, all ten members available, `codex-basic`, and `simulated-user-sol-high` before submission.
5. Preserve the run directory and inspect each execution’s resolved configuration, provider/model, outcome receipt, judge evidence, timing, usage trace, and any exact blocker.

## Paid-run bounds and blocking gap

The intended first baseline is one suite × one harness: exactly ten candidate executions. Each deterministically passing accepted turn can additionally invoke one simulated-user judge execution. The harness has `agentAuthored: true`, so candidate roots may also start provider-native semantic children; the current suite path declares no child-count, recursion-depth, provider-call, token, time, or monetary ceiling.

There is **no hard cost cap enforced for this suite**. `createRun` has no cost-cap or token-cap field, the dashboard asks for no ordinary-suite paid-run confirmation, and usage events are observational rather than an admission control. The only existing `liveAuthorization` checks apply to the special recursive Complete pair and graph-memory quartet. PRD §13.3 states: “Live commands require an explicit confirmation in Relayer Eval plus an available credential reference and declared cost cap.” Those three fields are missing from ordinary suite admission. The PRD does not itself specify whether a token, call, elapsed-time, or monetary mechanism should implement that bound; that product decision remains open. The baseline should not be launched as product-contract-compliant until this gap is resolved. A subscription/account spending limit is external account policy and is not a per-run Relayer cap.

Proposed repair scope, pending the bound semantics decision:

- add an ordinary paid-suite confirmation that binds the suite identity, one exact harness, resolved provider/model, opaque credential reference, ten root candidate executions, judge choice, and whether agent-authored children are allowed;
- define a measurable run bound and enforce it before and during execution (for example provider-call/token limits only if the adapter can actually stop at them); do not label an advisory estimate or account-wide limit a hard monetary cap;
- persist the authorization and observed usage with partial results, and provide cancellation that leaves immutable per-execution evidence;
- add deterministic service/UI tests for missing, altered, exceeded, cancelled, and reopened authorization state.

## Remaining effort

**Operator setup after the enforcement gap is repaired:** roughly 30–60 minutes of active work to create/check the isolated Eval profile, connect the intended provider, verify the resolved model and ten-case availability, choose the single harness and judge, review the declared bound, start the run, and record its run ID. This excludes any provider login or runtime repair that fails preflight.

**Preliminary engineering estimate for the missing live controls:** approximately 0.5–1.5 focused developer days for the selection contract, enforcement/cancellation seam, persistence, UI confirmation, and deterministic tests, assuming the chosen provider exposes a reliably enforceable unit. A true monetary cap may take longer or be unsupported for Codex subscription because current code records usage but exposes no authoritative per-call price/control surface.

**Live execution duration:** unknown from the current code and evidence. The suite contains ten substantial repository/workbook tasks, their deterministic verifiers, production rendering, and up to ten simulated-user judgments; provider-native children are model-controlled. There is no suite-wide deadline or historical accepted baseline from which to estimate wall time. Plan for an unattended multi-hour window and operator monitoring, but record actual per-case latency rather than presenting that planning allowance as an ETA.

This note is preparatory. It does not authorize paid inference or claim a live baseline.
