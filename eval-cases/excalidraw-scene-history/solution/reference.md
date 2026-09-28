# Excalidraw scene-history reference portfolio

This sealed reference is architectural guidance, not a patch-matching oracle.
The admission portfolio contains two behaviorally equivalent but materially
different implementations:

- an immutable snapshot DAG with eager element-aware three-way merge; and
- an encapsulated command-log controller backed by version and snapshot maps.

The corresponding patches are based on the pinned seeded Excalidraw commit and
integrate through `packages/excalidraw/index.tsx`. The portable modules mirror
the controller contract for fast non-UI mutation coverage. Portable UI results
are explicitly unqualified and are not upstream admission evidence.

Both are qualified exclusively through the public controller, accessible UI,
undo integration, ordinary export, history export, and historical import seams.
The verifier never reads candidate source text or compares a candidate diff with
either implementation.

The reviewed shortcut portfolio covers mutable history, head-only branching,
silent last-writer-wins merge, parent-order nondeterminism, broken bindings,
dropped groups, omitted assets, history leakage into ordinary export, multi-step
undo, legacy-field loss, and acceptance of future history schemas.

Real-workspace overlays exercise the candidate-verifier forgery boundary,
inert and miswired UI controls, and representative shortcuts for historical
branching, silent conflict loss, relationship validation, undo, and history
import. The remaining targeted mutants are currently portable-only: inaccessible UI, invalid common
ancestor, early conflict resolution, nondeterministic merge and ordering,
frame/container links, groups, assets, ordinary export leakage, future-schema
acceptance, and the separate legacy-field-loss variant. Portable rejection does
not qualify those boundaries against the upstream fixture.

The v1 product text requires working accessible controls. The sealed public UI
checkpoint activates every named control and observes the corresponding opaque
controller operation. Controller and upstream checks separately prove scene
application and the single-step undo boundary without constraining UI layout,
markup hierarchy, or candidate source structure.
