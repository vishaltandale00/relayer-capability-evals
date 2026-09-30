# Relayer capability evaluations

This repository owns the ten project capability cases introduced by GraphComplete PR #533. It contains their immutable definitions, fixtures, graders, mandatory-gate policies, focused tests, deterministic admission scripts, and historical evidence.

Generic execution contracts come from the public `@relayer/eval-runner` SDK in GraphComplete. This repository does not vendor the runner or schedule agents.

## Setup

Catalog consumers require Node 22.8 or newer. The current native focused and admission portfolio requires macOS on Apple silicon with Node 22.23.2; individual case preflight reports an explicit unavailable reason when its platform or exact runtime is absent. Install this repository's development tools, build the SDK in the GraphComplete checkout you intend to test, and link that exact checkout:

```sh
npm ci
npm run setup -- --runner /absolute/path/to/relayer-graphcomplete
npm run build
npm run check
```

`setup` requires `packages/eval-runner/dist/index.js` in the selected checkout. The symlink under `node_modules` is ignored. Production catalog loading uses the committed `packages/capability-evals/dist` plus that peer link.

Spreadsheet cases require `RELAYER_SPREADSHEET_NODE` and `RELAYER_SPREADSHEET_NODE_MODULES`. The emergency case accepts `RELAYER_EVAL_NODE` and otherwise validates the current Node executable. Catalog preflight marks a case unavailable before queueing when its platform or runtime is unsuitable.

The root `catalog.mjs` exports the unchanged ten-case capability catalog. The `interactive-catalog.mjs` entrypoint composes those registrations with eight interactive everyday cases and a second pinned suite manifest using the same SDK contract. Each registration exposes its bound immutable case, public definition projection, availability, materializer, grader, and mandatory-gate evaluator.

## Verification

`npm run check` runs TypeScript checking and the native focused package tests without paid inference. The `eval:admit:*` scripts are heavier deterministic macOS entry points. Evidence under `docs/evidence/issue-278-capability-suite` predates extraction and is historical until regenerated against an exact commit in this repository.

Cross-repository CI remains pending until the GraphComplete SDK changes are merged and can be pinned by commit. Local verification must therefore record both the external catalog commit and selected GraphComplete SDK commit.


## Interactive human exploration

`interactive-catalog.mjs` exposes `interactive-human-exploration-v1`, a separate
exploratory ten-task manifest:
two unchanged coding cases and eight everyday cases. The optional private
interactive contract requires the matching GraphComplete SDK and external Human
Grader integration. Keep the original autonomous suite separate.

Each everyday workspace requests a shareable `deliverable.md`. The restaurant
workspace includes `restaurant-server.mjs`; start it with Node and use its printed
loopback URL. Its records are fictional and persistent in that task workspace.
Human review remains necessary for graph decisions, current research and intent
fit. The deterministic artifact-presence check is not a quality judgment.

`npm run test:interactive-restaurant` runs the real local website in Electron
and verifies search, availability, booking, modification, restart and cancellation
without inference or real reservations. Run it after changing this fixture.

The earlier untracked `interactive-cases/` draft is not loaded or overwritten.
This registered set does not mandate a correction or reuse its old holdout split.
