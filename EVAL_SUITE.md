# Capability eval suite

This repository preserves the first ten verifier-backed capability-eval cases developed for [Relayer GraphComplete Issue #278](https://github.com/vishaltandale00/relayer-graphcomplete/issues/278).

## Evidence model

- `admitted` means the untouched baseline is red, two materially different implementations are green, adversarial mutants are rejected, the focused production seam passes, and an exact reviewed source snapshot is recorded.
- `candidate` means useful implementation work exists but the verifier or admission evidence is incomplete. Candidate branches must not be treated as passing evals.
- Each branch is an exact case checkpoint. The cases deliberately remain separate until shared router, catalog, service, and test seams are integrated and the combined snapshot is re-admitted.

## Case inventory

| Case | Status | Branch | Source evidence |
| --- | --- | --- | --- |
| Tournament operations | admitted | `cases/tournament-operations` | Original PR #284, head `4f958255300d073def45d597e6dbcffdf4ed4501` |
| Reservation and capacity | admitted | `cases/reservation-capacity` | Original PR #285, head `ee2d81cbc85c1dc9dbf0240433e9217fdfa5ab68` |
| API contract simulation laboratory | admitted | `cases/api-contract-lab` | Original PR #287, head `f505cd6fe41cb0ccbe50694f46bf8805fdb7c4d4` |
| Node Redis command-queue race | admitted | `cases/node-redis-queue-race` | Original PR #286, head `de6ee5c1116e4f7eca14c4c998a11c229228cb88` |
| HTTPCore cancellation-poisoned pool | admitted | `cases/httpcore-cancellation-pool` | Original PR #288, head `63a55ad06fa84bbb8bd51b18b6eaade070003a18` |
| Emergency evacuation planner | candidate | `candidates/emergency-evacuation` | Focused 29/29, full check and build passed; rejected by authority review before commit |
| Excalidraw branching scene history | candidate | `candidates/excalidraw-scene-history` | Approved v1 semantics encoded; real pinned-workspace admission was interrupted |
| JupyterLab execution bundles | candidate | `candidates/jupyterlab-execution-bundles` | Pristine-delta hardening in progress; final admission interrupted |
| SaaS operating-model workbook | candidate | `candidates/saas-operating-model` | Focused verifier green; final build/admission interrupted by disk and usage limits |
| Production delivery planner workbook | candidate | `candidates/production-delivery-planner` | Expanded global-consistency mutant portfolio was still running when interrupted |

Original PR numbers refer to [`vishaltandale00/relayer-graphcomplete`](https://github.com/vishaltandale00/relayer-graphcomplete).

## Reproducing a case

Check out the named branch and follow the case-local `README.md` or verifier documentation under `eval-cases/`. Do not infer suite-level compatibility from a single case branch: the five admitted branches independently touch shared runner seams and need an explicit integration pass before a combined run is meaningful.

## Integration frontier

1. Rebase or merge the five admitted cases through the shared catalog, service, and routing seams.
2. Resolve conflicts without weakening any case-local verifier.
3. Add one versioned suite manifest that pins case IDs, fixture/runtime identities, verifier digests, and admission receipts.
4. Run every admitted case from the combined snapshot and publish the exact results.
5. Harden and re-review candidate cases individually before promoting them to `admitted`.
