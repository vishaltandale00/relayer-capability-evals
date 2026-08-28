# Excalidraw scene-history reference portfolio

This sealed reference is architectural guidance, not a patch-matching oracle.
The admission portfolio contains two behaviorally equivalent but materially
different implementations:

- an immutable snapshot DAG with eager three-way merge; and
- an append-only event/delta DAG with lazy snapshot materialization.

Both are qualified exclusively through the public controller, accessible UI,
undo integration, ordinary export, history export, and historical import seams.
The verifier never reads candidate source text or compares a candidate diff with
either implementation.

The reviewed shortcut portfolio covers mutable history, head-only branching,
silent last-writer-wins merge, parent-order nondeterminism, broken bindings,
dropped groups, omitted assets, history leakage into ordinary export, multi-step
undo, legacy-field loss, and acceptance of future history schemas.
