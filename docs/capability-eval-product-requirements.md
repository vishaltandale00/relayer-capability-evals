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


## Exploratory interactive set (approved 2026-09-30)

A separate candidate manifest contains Tournament Operations and Node Redis with
their existing contracts, plus eight everyday interactive tasks: European trip,
restaurant celebration, local weekend, news discussion, learning plan, workspace
refresh, community workshop and household move. The original autonomous suite
retains its exact membership and identities. This set is exploratory, not a
comparative baseline or a promotion gate.

Use the canonical SDK case snapshot's optional interactive contract. It pins
participant facts, reviewer criteria, research requirements, endpoint and limits.
Private facts and criteria remain outside the public projection and candidate
workspace. Participant answers arise naturally; no mandatory correction sequence
or fixed traversal is imposed. Cases require current research with sources and
retrieval dates and a concrete final output. Human review assesses intent fit,
answer incorporation and decisions throughout the graph; artifact existence is
only an objective prerequisite and does not certify those qualities.

The restaurant is an explicitly fictional loopback website. Its fixture supports
search, availability, booking, modification, cancellation, and persistent
confirmation/event records. It performs no real transaction. Other cases permit
research and planning, not purchases or commitments. A participant need not
exercise every restaurant action in one trajectory.

GraphComplete owns external admission, subscription authority, rendering timing,
case selection and human review. Backend state timestamps cannot prove when an
updated graph visibly begins appearing. This case package makes no timing claim.

On 2026-10-02, the user increased the interactive submission ceiling from 8 to 30.
New everyday case snapshots and the exploration suite pin this ceiling. Existing
run snapshots retain their original budgets. Actor action and time limits remain
independent; this change does not raise them or require 30 submissions.
