# Interactive human exploration verification

This change packages the approved exploratory ten-task set. It does not certify
comparative quality, taste fit, current research, or rendered graph latency.
The selected SDK is GraphComplete's `codex/interactive-catalog` worktree based on
08df645ce0f472dc538d392590c1a82226e4b1c1 (calibration PR #628).

| Changed seam | Checkpoint | Proof |
| --- | --- | --- |
| Canonical registration and composed catalog | Original coding identities and adapter bytes retained, ten ordered exploratory members, separate autonomous suite | `interactive-pilot.test.ts`, existing `catalog-adapter` and Tournament sealed-byte tests |
| Public projection and private profiles | Real catalog omits each participant brief and private reviewer criterion | `interactive-pilot.test.ts` |
| Snapshot authority | Profile and verifier digests match actual sealed bytes; static suite rejects drift | `interactive-pilot.test.ts` |
| Workspace materialization and output gate | No private participant brief in candidate workspace; absent artifact fails and nonempty artifact passes presence only | `interactive-pilot.test.ts` |
| Restaurant request/persistence boundary | Capacity cannot be oversold; modification persists across restart; cancellation and history retained | `interactive-pilot.test.ts` |
| Restaurant browser interaction | Real form/search/availability/booking/edit/cancel controls work, confirmation survives server restart | `npm run test:interactive-restaurant` |

Required: `npm run build`, `npm run check` under Node 22.23.2, and restaurant
browser proof. No paid inference. Existing admission portfolios for unchanged
coding fixtures are not rerun or claimed by this change.

Earlier check under Node 25 failed the existing Node-22-only reservation tests.
An initial implementation also changed the sealed original catalog adapter;
that was reverted and replaced with composition through the same SDK entrypoint.
Neither failure is suppressed by updating original coding fixture identities.
