# Sealed Excalidraw scene-history verifier

`excalidraw-scene-history-v1` is implemented in
`packages/capability-evals/src/project-cases/excalidraw-scene-history.ts`.

The evaluator captures the candidate diff from the deterministic seeded commit,
applies it to a pristine clone, installs the frozen dependency graph, injects a
temporary evaluator-owned Vitest consumer, and then runs the public behavior
matrix, the bounded package build, and the existing history/restore/export tests.
Predicates are emitted independently. Candidate tests, source text, filenames,
and the sealed reference are not grading authority.

The case remains `candidate`. The portable red/two-green/mutant portfolio keeps
fast predicate coverage, while upstream admission requires the untouched seeded
workspace and both checked-in reference patches to pass the real workspace
grader. Evidence must be invalidated whenever a content-addressed case input
changes.

Qualification command authority is frozen to the seeded bytes for `package.json`,
`yarn.lock`, `vitest.config.mts`, `setupTests.ts`,
`packages/excalidraw/package.json`, `packages/excalidraw/tsconfig.json`, and
`scripts/buildPackage.js`. Candidate feature source, exports, and tests remain
editable. The verifier reconstructs the candidate, checks this authority set
against the seeded commit, and only then installs or executes its commands.
Imports used by the sealed test still rely on pinned upstream test helpers;
defending against an arbitrary candidate rewriting every helper is outside this
portfolio's declared authority boundary.
The tracked authority comparison also covers `.npmrc` and root `tsconfig.json`;
the seeded-absent `.yarnrc` and `.yarnrc.yml` must remain absent so an untracked
package-manager redirect cannot replace the frozen Yarn invocation.
