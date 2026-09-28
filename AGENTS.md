# Agent instructions

Read `README.md` and `docs/capability-eval-product-requirements.md` before changing case behavior.

- This repository owns the ten project capability cases introduced by GraphComplete PR #533, their fixtures, graders, gate policies, focused tests, admission scripts, and evidence.
- Import generic case and suite contracts from the public `@relayer/eval-runner` SDK. Link a selected built GraphComplete checkout with `npm run setup -- --runner /absolute/path/to/relayer-graphcomplete`.
- Keep case execution native to the host harness. The catalog supplies registrations and deterministic acceptance policy; it does not schedule agents.
- Preserve immutable snapshot, verifier, reference, and suite digests when source bytes change.
- Use deterministic focused tests and admission portfolios without paid inference.
- Run `npm run build` and `npm run check` before committing. Commit `packages/capability-evals/dist` so a pinned catalog commit is directly loadable after setup.
- Treat `docs/evidence/issue-278-capability-suite` as historical after extraction unless a receipt is regenerated against the exact current commit and source paths.
