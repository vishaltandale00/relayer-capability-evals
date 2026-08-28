# Capability eval suite

This repository preserves the first ten verifier-backed capability-eval cases developed for [Relayer GraphComplete Issue #278](https://github.com/vishaltandale00/relayer-graphcomplete/issues/278).

## Evidence model

- `admitted at source head` means the untouched baseline is red, two materially different implementations are green, adversarial mutants are rejected, the focused production seam passes, and an exact reviewed source snapshot is recorded. Integration changes invalidate source-byte attestations until the combined `main` snapshot is re-admitted.
- `candidate` means useful implementation work exists but the verifier or admission evidence is incomplete. Candidate branches must not be treated as passing evals.
- Each branch remains an exact case checkpoint. All ten are now merged on `main` through one explicit case registry and project-case dispatcher. The combined snapshot builds, but it is not yet a ten-case admission receipt.

## Case inventory

| Case | Status | Branch | Source evidence |
| --- | --- | --- | --- |
| Tournament operations | admitted at source head; re-admission pending | `cases/tournament-operations` | Original PR #284, head `4f958255300d073def45d597e6dbcffdf4ed4501` |
| Reservation and capacity | admitted at source head; re-admission pending | `cases/reservation-capacity` | Original PR #285, head `ee2d81cbc85c1dc9dbf0240433e9217fdfa5ab68` |
| API contract simulation laboratory | admitted at source head; re-admission pending | `cases/api-contract-lab` | Original PR #287, head `f505cd6fe41cb0ccbe50694f46bf8805fdb7c4d4` |
| Node Redis command-queue race | admitted at source head; re-admission pending | `cases/node-redis-queue-race` | Original PR #286, head `de6ee5c1116e4f7eca14c4c998a11c229228cb88` |
| HTTPCore cancellation-poisoned pool | admitted at source head; re-admission pending | `cases/httpcore-cancellation-pool` | Original PR #288, head `63a55ad06fa84bbb8bd51b18b6eaade070003a18` |
| Emergency evacuation planner | candidate | `candidates/emergency-evacuation` | Checkpoint `7c1425f2`; focused 29/29, full check and build passed; rejected by authority review before admission |
| Excalidraw branching scene history | candidate | `candidates/excalidraw-scene-history` | Checkpoint `2ab794e9`; approved v1 semantics encoded; real pinned-workspace admission was interrupted |
| JupyterLab execution bundles | candidate | `candidates/jupyterlab-execution-bundles` | Checkpoint `080bb265`; pristine-delta hardening in progress; final admission interrupted |
| SaaS operating-model workbook | candidate | `candidates/saas-operating-model` | Checkpoint `6dbbae56`; focused verifier green; final build/admission interrupted by disk and usage limits |
| Production delivery planner workbook | candidate | `candidates/production-delivery-planner` | Checkpoint `63636859`; expanded global-consistency mutant portfolio was still running when interrupted |

Original PR numbers refer to [`vishaltandale00/relayer-graphcomplete`](https://github.com/vishaltandale00/relayer-graphcomplete).

## Reproducing a case

Use `main` to exercise the integrated catalog, or check out a named source branch to reproduce its historical admission receipt. Do not infer combined admission from a source-branch receipt: shared service bytes and sealed digests changed during integration.

## Integration frontier

1. Add one machine-readable suite manifest that pins case IDs, fixture/runtime identities, verifier digests, and admission receipts.
2. Re-run every source-admitted case from the combined snapshot and refresh only evidence that passes unchanged semantics.
3. Run Node-22-only cases under their pinned runtime; do not weaken runtime checks for the ambient Node version.
4. Harden and re-review candidate cases individually before promotion.
5. Publish one exact combined-suite receipt after every included case reaches its declared gate.
