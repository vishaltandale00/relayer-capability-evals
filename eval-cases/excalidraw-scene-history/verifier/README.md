# Sealed Excalidraw scene-history verifier

`excalidraw-scene-history-v1` is implemented in
`packages/eval-runner/src/project-cases/excalidraw-scene-history.ts`.

The evaluator captures the candidate diff from the deterministic seeded commit,
applies it to a pristine clone, installs the frozen dependency graph, injects a
temporary evaluator-owned Vitest consumer, and then runs the public behavior
matrix, the bounded package build, and the existing history/restore/export tests.
Predicates are emitted independently. Candidate tests, source text, filenames,
and the sealed reference are not grading authority.

The case remains `candidate`; admission evidence is maintained by the local
red/two-green/mutant/property portfolio test and must be invalidated whenever a
content-addressed case input changes.
