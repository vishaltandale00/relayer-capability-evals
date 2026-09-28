# Capability evaluation product requirements

These requirements are extracted from the GraphComplete PR #533 product
contract at commit `a6b535236c543544bd2f1f7ad1c49016f506b19f`. The repository
ownership split was explicitly decided during integration: this repository owns
case semantics and evidence; GraphComplete owns generic execution and graph
presentation.

Each capability case has five separate, content-addressed artifacts: a visible
task, frozen workspace, sealed reference, sealed verifier, and outcome rubric.
Public catalog data must omit evaluator-only sealed paths. Qualification recreates
a pristine seed, applies only the candidate's committed delta, and checks the
real public seam. Source matching and resemblance to a reference implementation
are not qualification evidence.

The suite contains exactly the ten PR #533 cases in its declared order. It pins
each case snapshot digest, outcome contract, presentation policy, and the suite
manifest digest. Missing, duplicate, or drifted cases make the suite unavailable.
Graph presentation remains a separate generic GraphComplete judgment and cannot
compensate for failed task-outcome qualification.

Verifier admission is exact-source evidence. The untouched fixture must be red
for the intended behavior, two materially different reasonable implementations
must be green, and shortcut mutants must fail their relevant predicates. Changes
to a fixture, contract, materializer, verifier, reference input, environment,
source path, or compiled evaluator invalidate earlier evidence. Default admission
and regression checks use no inference.

The external catalog registers case definitions and callbacks only. It does not
schedule model work. Harness providers retain their native recursive execution;
GraphComplete retains graph scope, acceptance, and completion semantics.
