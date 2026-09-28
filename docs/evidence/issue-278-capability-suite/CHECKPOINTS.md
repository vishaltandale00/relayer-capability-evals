# Changed seams and verification checkpoints

## Current reading guide

The current deterministic result is `ADMISSION_INDEX.json`: all ten portfolios
passed with captured inputs verified. The ledger below preserves chronological
work, including pending states and failed attempts that were later superseded.
Final Planner receipt SHA-256 is
`5e31ea4ff0bf23ca8e43d0c1b5db26d1608a104d04be5dd70f339af13420a181`;
final SaaS receipt is
`c71b40ab940dc194ba0dd24da173b72396fad24f5c784c992b1552303bcc38be`.
Both bind the final compiled runner, and both report stable inputs. The merged-upstream 32-file review supersedes earlier reviews for changed
service, launcher, suite-binding, and renderer inputs; the final heavy review
binds the refreshed portfolios. Full repository and
browser handoff gates are recorded separately in the PR against frozen source.
No paid inference or accepted live baseline is claimed.

## Checkpoint mapping and chronological evidence

Authority: PRD 13.2 versioned harness-capability suite, 13.2.2 verifier
admission, 13.3.1 artifact-verifiable candidates, 13.4 presentation judgment,
and ADR 0003 production product/Eval workspace. This mapping describes required
proof; it is not a passing receipt. Source changes invalidate affected results.

| Changed executable seam                                    | Promise or boundary                                                                                                                                                                     | Smallest current production-seam check                                                                                                                                                                                                           |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `suites/capability-pilot-v1.ts` resolution and digest      | Exact ordered ten cases; fixed snapshot and outcome/presentation identities; missing, duplicate, or drifted members fail closed                                                         | `capability-suite-manifest.test.ts`: ordered membership, recomputed identity, duplicate/missing cases, manifest and grading drift                                                                                                                |
| Case verifier identity construction                        | TS source and compiled Node imports represent the same immutable case                                                                                                                   | Same manifest test launches compiled Node; individual case source-normalization tests bind actual source bytes                                                                                                                                   |
| Suite public projection                                    | Catalog must not expose sealed references, private paths, or verifier payloads                                                                                                          | Manifest safe-projection test                                                                                                                                                                                                                    |
| `expandCapabilitySuiteRun`                                 | Use ordinary case-by-harness expansion with immutable suite identities                                                                                                                  | `run-plan.test.ts`: ordered suite matrix and frozen independent identity                                                                                                                                                                         |
| `EvalService.catalog/createRun`                            | Unavailable members and caller member overrides must reject before queueing                                                                                                             | `eval-app-integration.test.mjs`: suite unavailable/override rejection through real service                                                                                                                                                       |
| `EvalService` run/execution persistence                    | Suite identity survives actual creation, disk persistence, and reopen                                                                                                                   | `eval-service-simulated-user.test.mjs`: `persists and reopens the exact ordered capability suite identity through createRun`                                                                                                                     |
| Dashboard suite selector and availability                  | Render the suite catalog; an available selection sends the exact ten-member suite while an ordinary manual case clears it; unavailable suites are disabled with their reason visible    | `eval-suite-selection.test.mjs` plus `scripts/test-eval-web.mjs` through the real web host; combined browser evidence passed in `combined-eval-web.log` (SHA-256 `c16a4be09cb8a77019a20916e6ad2ea7bd80d495b11fcb5d990b5151e63052af`)             |
| `EvalService.open` historical grade recovery               | Preserve finalized historical grades and absent legacy grades; settle only actually interrupted reviews                                                                                 | `eval-service-simulated-user.test.mjs`: finalized historical grade, absent terminal grade, and mixed active/already-interrupted executions reopened from real disk state                                                                         |
| Imported case catalog, dispatcher, and mandatory gates     | Every imported case reaches its own materializer/grader; presentation never overrides failed outcome                                                                                    | `eval-app-integration.test.mjs` catalog/dispatch cases and `eval-service-simulated-user.test.mjs` outcome/presentation checks                                                                                                                    |
| SaaS runtime routing                                       | Pass authenticated raw runtime paths to SaaS and a distinct adapter contract to the planner                                                                                             | `eval-service-simulated-user.test.mjs`: authenticated spreadsheet authority through actual SaaS run/materializer/inspector seam                                                                                                                  |
| Production planner and shared spreadsheet runtime identity | Bind both normalized source authorities into the planner verifier and case snapshot; manifest fields must match the live semantic snapshot, verifier, environment, and raw source bytes | `production-delivery-planner.test.ts`: source normalization, verifier contract, admission-manifest binding, and compiled-loader suite parity; the current named portfolio is indexed in ADMISSION_INDEX.json                                                        |
| Host runtime preflights                                    | Explicit invalid or unavailable runtime withholds affected cases                                                                                                                        | Case runtime preflight tests and suite unavailable-member test; real configured-host availability must be observed before live execution                                                                                                         |
| Emergency runtime authentication                           | Authenticate exact Node bytes before executing; persist runtime identity predicate                                                                                                      | `emergency-evacuation-case.test.ts`: wrong-binary rejection, independent positive runtime eligibility, production qualification                                                                                                                  |
| Emergency dependency and sandbox boundary                  | Reject third-party dependencies before any candidate launch; exclude neighboring runtime packages                                                                                       | Same file: forbidden-dependency launch observation, external import/child-process/environment mutants, two alternative planners and shortcut matrix                                                                                              |
| HTTPCore verifier source identity                          | Bind the normalized TypeScript verifier bytes into the immutable case snapshot while preserving the historical receipt under its original identity                                      | `httpcore-cancellation.test.ts` source-normalization and snapshot checks plus compiled-loader suite parity; the source-bound named HTTPCore portfolio is indexed in ADMISSION_INDEX.json                                                            |
| API qualification runtime                                  | Explicit new sandbox-byte identity; authenticate tool bytes before version probe; no false test skips from broken preflight                                                             | `api-contract-simulation-laboratory.test.ts`: fake-node marker, independently authenticated preflight, real pristine projects and authority mutants                                                                                              |
| Product workspace terminal disposal                        | Completing or releasing an in-flight send after workspace disposal must not restart node selection or authored-detail rendering                                                         | `node-detail-runtime.test.mjs`: `resolves context-preview images from their original presenting interaction and layer` disposes the real workspace, then observes that the mounted host is not replaced and its released shadow tree stays empty |
| Native Web Crypto observation                              | Node Detail asset proof must wait for the actual integrity-check and mount promise, rather than treating Happy DOM's task queue as completion authority                                 | The same production-workspace regression uses `vi.waitFor` on the resolver call and mounted image before disposing browser globals; this is distinct from the terminal-disposal guard                                                            |

The default fallback remains `npm run check` for any unmapped changed seam.
`npm run build` is also required before committing. Named HTTPCore and Node
Redis admission runners supply scoped heavy evidence; candidate portfolios and
browser-host evidence remain separate. Portable or stubbed tests cannot certify
real upstream builds or workbook behavior. New authority and historical-recovery tests protect distinct boundaries from
ordinary outcome tests. One Planner helper-array test was retired only after
the replacement real-workbook regressions passed and independent Sol review
confirmed they observe the same positive/negative lineage boundary through
production extraction. Its test-only helper export was removed as well.

The Node Detail disposal regression was red before the guard and then passed as
part of 74 focused tests across two files. Raw evidence is preserved outside the
repository as `node-detail-dispose-regression-red.log` (SHA-256
`eaf668afeb0b57c6cc08ffd385fc7afb014624a773ae92a5a362b0d6ae67a9d2`)
and `node-detail-dispose-regression-green.log` (SHA-256
`7ab076da853df2a00151aa1216d9925612e0804d857773e5242995bfc2c82244`).
GPT-5.6 Sol performed a read-only adversarial review of workspace diff
`78bffddd0b7204ef0f9f913680989c8bb95dd7b38dbadf53cba3005432f2fe63`
and reported no findings. The review is non-certifying because there is no PR;
its durable record is `node-detail-review.json` (SHA-256
`b44740c815a3dcef30fdb89bc4f63f925372e74c375478984dcb1e966ed29140`).

## Current named admission evidence

Evidence root: `/Volumes/2T-SSD/eval-evidence/2026-09-27/`. These results apply
only to the bound inputs recorded in each receipt, not to the entire workspace.

- Emergency: `emergency-admission-v3/receipt.json`, SHA-256
  `830a0d00f5f56e596285425f579ee030b99adea41846d1c460b6ab83f59bfa04`.
  Named production portfolio: 20 passed, zero failed/skipped/missing required
  assertions, stable before/after inputs. Earlier v1/v2 failures remain preserved.
- SaaS: `saas-operating-model-final/admission-receipt.json`, SHA-256
  `49aeffd609c49ae6b209e7d4e646fc1d814b3d16b12dd478f912e94b7beb3e85`.
  All six entries met their exact expected classification: untouched baseline
  red, two distinct greens, three targeted mutants red. Runtime preflight and
  before/after source/dist bindings passed. Later dist changes require rebinding.
- Planner: `production-delivery-planner-final/admission-receipt.json`, SHA-256
  `e6c275dee74ecd72a538b674328c8d8eb2d21089d24225960416b1092dd63708`.
  **Incomplete/failing**: baseline expected red; first green failed shipment timing,
  cost arithmetic, cross-sheet consistency, and changed-input predicates. Inputs
  were stable. Read-only diagnosis found an incorrectly dated reference shipment
  and unqualified cross-sheet references; fixes and fresh proof remain due.
- HTTPCore: `httpcore-source-bound-final/raw.log`, SHA-256
  `e2ccbe8c5821ea96e46527884e71b5fa91a380e41b59c4e76e8d4d30a82d3445`.
  Fresh production portfolio passed the exact historical matrix (baseline, two
  greens, seven mutants) under implementation-bound verifier
  `sha256:0365d51724d53169f904cab19ef96ef3537f84187e02a8f08ae9e4b25b976906`.
  Exit 0 and identical before/after bound files are recorded in
  `httpcore-source-bound-final/execution.json` and its adjacent input snapshots.
  Historical receipt remains unchanged; its stated Python-process authority
  limitation remains unresolved and explicit.
- JupyterLab: `jupyterlab-admission-v3/receipt.json`, SHA-256
  `ac7ca7004790d35560bc5f3e5b7864bed7d40a6243df428b17cd6a7aaf13c76a`.
  All ten exact expected classifications passed under the production materializer
  and grader, including both real upstream greens, stable bound inputs, protected
  configuration rejection, and independently isolated post-test delta rejection.
  The outer raw log is SHA-256
  `8d5914b175f1d6cc62bdc73493c4c660821dff63a552da91fc96c02ec72a2266`.
  Earlier v1/v2 failure receipts are preserved and do not count as passing proof.

## Scoped integration review

GPT-5.6 Sol reviewed suite/service/browser/native-recursion behavior at scoped
source digest `141b9d2f1aafb23adcf7b5b47ba073537fd520f5e86b17f6b17cd70faf4f9ae9`
and reported no findings. The durable assertion is `integration-review.json`
(SHA-256 `48059ed202f95703857d7ef2179176c6dd5ac46eae86b30538265b7159f0a380`).
This review excludes the changing planner and Excalidraw implementations and is
non-certifying without a PR. Changes to the listed files invalidate that scope;
final suite pin changes require a fresh review assertion.

## Newly repaired candidate seams — final admission still required

- Excalidraw live editor capture, historical checkout, unresolved/completed merge,
  and ordinary native undo: the generated sealed upstream verifier observes the
  mounted editor, real keyboard history, displayed state, and immutable graph.
  Portable fixtures are explicitly insufficient for UI/native qualification.
- Excalidraw accessible interaction and durable export: one semantic driver
  exercises inline and dialog reference UIs, real branch/merge parentage, chosen
  public conflict values, and the full exported/imported graph. No filename or
  fixed DOM layout defines success.
- Excalidraw native assets/app state: a mandatory predicate checks colliding
  canonical file IDs, applied image references/bytes, canonical subsequent
  capture, background state, undo, and unchanged historical snapshots.
- Excalidraw result transport: `excalidraw-scene-history.test.ts` exercises the
  production grader with failed, missing, duplicate, unexpected, and invalid
  assertion transports. A native failure or an inconsistent command result
  must never become an all-green workspace.
- Excalidraw command authority: the visible task names the exact seeded package,
  lockfile, test configuration, setup, and build files that qualification trusts.
  The reconstructed workspace must preserve those bytes before installation or
  candidate commands. A forged-runner mutant must be rejected at that boundary;
  complete command output must survive workspace cleanup. This does not claim
  protection against arbitrary sabotage of editable worker/helper internals.
- Eval mandatory-outcome mapping: the real service must include the native
  asset/app-state predicate and all four changed-scenario predicates in the
  declared gates. A failed or missing required check must withhold qualification
  independently of presentation. Service regressions cover the downstream
  mapping; case-only tests cannot prove this boundary.
- Planner reference arithmetic and visible signals: production, fulfillment,
  rolling inventories, purchases, costs, exceptions, and chart source formulas
  are observed through the actual XLSX runtime. Optional dashboard signals may
  show a valid subset of weeks; required production tables retain full coverage.
- Planner editable controls and semantic location: production grader mutation
  checkpoints use the same labelled-value meanings/aliases as extraction, allow
  headerless controls, and choose changes from the actual baseline. Independent
  feasibility is the authority; an otherwise legal plan need not change merely
  because a constraint has slack. Binding capacity changes must trigger a
  consistent response. Focused mapping/locator regressions live in
  `production-delivery-planner.test.ts`; the named workbook portfolio is the
  heavy production-seam proof.

These mappings describe required checks, not a claim that all final source has
passed them. Full `npm run check` remains the deterministic fallback for any gap.

## September 27 finalization attempts

All paths below are relative to `/Volumes/2T-SSD/eval-evidence/2026-09-27/`.
These receipts apply to their captured inputs, not subsequent repairs.

- `final-npm-check-v1`: failed two timing-sensitive Vitest tests under heavy host
  contention. Both passed unchanged in the focused diagnostic run. The complete
  retry `VITEST_MAX_WORKERS=1 npm run check` in `final-npm-check-v2` passed all
  stages, with 2509 Vitest tests passed and 17 explicitly skipped. No assertion
  or timeout was weakened. Both runs captured identical source snapshot
  `35f189706a95186a0b7935bad118ee2f15c4ee362b2057f257b847168e45ee85`.
  Passing raw-log SHA-256:
  `c11f985f575e90aeba1146af426703c7926aacf6ff7772234217388a64eaa2a6`.
- `final-npm-build-v1`: passed with that same unchanged source snapshot; raw-log
  SHA-256 `7adc1c0d0bc78aac44f49346b69f6f42af6005bba1e7d2382a777de6197fbeb6`.
- `reservation-tournament-api-final/receipt.json`: 40/40 focused tests passed
  (Reservation 20, Tournament 5, API 15), with stable captured inputs. The
  top-level Vitest process used Node **25.9.0**; inner qualification runtimes
  retain their own pinned-byte guards. Receipt SHA-256:
  `c397f426b44175984332517b9678e5aba416caa4f7a8d00f0283a7a1c6da084d`.
- `saas-operating-model-final-frozen-35f1897/admission-receipt.json`: all six
  exact classifications passed, including both greens and three mutants, with
  stable source/runtime/whole-dist inputs. Receipt SHA-256:
  `1791fa4fae0e1563f6db11ae82561d96923c4ea4f38a64199d0875b240d2f091`.
- `jupyterlab-admission-final-v4/receipt.json`: all ten exact classifications
  passed, including both greens and both authority mutants. The outer
  `final-jupyterlab-gate-v1` also confirmed the full source snapshot above
  remained unchanged. Receipt and raw-log SHA-256:
  `67f3350e295e50f8feeb5b539f000f0aa2fd7c7d7b14059076bc90a29db99ee8`.
- `production-delivery-planner-final-frozen-35f1897`: incomplete. Baseline
  classified correctly; green-primary failed. Actual workbook import exposed
  date-formatted numeric receipts, sparse exception extraction stopping early,
  and constant formulas with no lineage. A later reference write also erased
  the component mutant. Preserve the failure; repair and fresh proof are due.
- `excalidraw-admission-final13`: incomplete. Both green patches truncated the
  generated source because of incorrect hunk counts; an authority mutant then
  failed patch application. External exact-seed application review also found
  two stale mutant contexts. Mechanical repair does not establish admission.
  Independent review found the reference controllers identical despite different
  interfaces, so a materially independent second implementation is required.

Additional repair checkpoints: Planner must import receipts as numeric values,
extract exactly the semantic exception rows despite blank rows and unrelated
notes, and preserve the intended mutant in the final emitted workbook. The
real Eval host must supply the complete spreadsheet-runtime fingerprint. The
opt-in browser proof must assert that all ten suite members are available and
record the exact suite identity before exercising selection.

The corrected Excalidraw portfolio subsequently passed all thirteen entries in
`excalidraw-admission-final13-v2`, with stable scoped inputs. The versioned copy
is `excalidraw-admission.json`, SHA-256
`3a6a7da05545eb37b4ac800fa6d998665908cb2ab6137abab0d8e41eda60447d`.
Its snapshot is
`sha256:37aabb0c67bfc7448018af39b1b5c77ea8818f4c7eaddfc10808e246ef2de957`.
The second green now derives controller state by replaying an immutable event
log, independently of the first green's snapshot-map state. Both greens passed
the real native editor seam. The ten mutants matched their exact expected
failure sets. This does not resolve arbitrary editable-helper sabotage or claim
decoded-pixel image equivalence.

The intermediate real-browser run in `browser-availability-intermediate/raw.log`
passed with `RELAYER_EVAL_REQUIRE_CAPABILITY_SUITE=1`, pinned spreadsheet runtime,
and all ten cases available. It exercised selection and deterministic fixture
execution. Its logged suite digest was `sha256:a389e0325e7a416b555ba91dbceb78204ea30aacd503f370c0790e1a2995fe9b`;
subsequent Planner pin changes require final browser proof. Raw-log SHA-256:
`8363fb6c531c6f47223b866d3705a56488a07b0903f134367d63d40be57b79a0`.

Planner's corrected numeric import and exact sparse exception regression passed.
Both actual green workbooks then passed all semantic and changed-scenario checks,
and the emitted component mutant was observed as 16 versus 15 consumed units and
rejected. The first `planner-final-12896d56` named run passed its baseline and
both greens, then stopped at the hardcoded mutant's unexpected collateral
failures. Its skipped formula writes left stale static receipt/cost/exception
values. That failure is preserved; generating a valid workbook before freezing
its formula outputs is the intended isolated hardcoding mutation.

Final Planner review found an unsupported formula restriction: the old rule
required every formula to have an A1-style precedent and imposed global formula
and role counts. Constant display formulas and named references could therefore
reject reasonable workbooks. The corrected checkpoint follows the existing PRD
promise of formula/layout freedom: require no recalculated formula errors and
actual formulas in derived output cells located through semantic table headers,
columns, and source row coordinates. Raw inputs and unrelated decorative cells
do not establish derived calculations. Blank-result formulas inside sparse
exception outputs remain recognizable. Formula counts and textual precedent
matches are diagnostics, not mandatory thresholds.

The ten separately mandatory changed-input/scenario probes remain the operational
lineage proof. Real workbook regressions cover named references and harmless
decorative formulas in a green, and a valid calculated workbook frozen to static
outputs with decorative formulas only. The latter must pass baseline arithmetic
and fail exactly lineage plus the ten changed-response checks. This mapping does
not replace semantic feasibility checks or broaden mutant failure expectations.


## Frozen final replay

The final Planner snapshot is
`sha256:9aa018e22c0eabe490044c47cd71cb6b0e86464f70890ba78cee4de3a978143a`,
with verifier
`sha256:6ca3bdb887ce57788a09cd6b2deaf389b8103db40e34acc1810318845e45e704`.
The ordered suite digest is
`sha256:911e9db20eaa33c4ff884c3bcd9104104a1767afc84c73ba7728a124f7f14b74`.
The compile and three-file deterministic contract run passed: 27 tests passed;
16 actual-runtime tests were explicitly skipped because that fast invocation
omitted runtime opt-in. Those skips are not runtime proof. The separate declared
actual-runtime green regression passed both workbooks, named-reference and
blank-result formula coordinates, harmless decorations, and scenario aliases.
Its raw output is `planner-lineage-warm/green-proof.log`. The hardcoded output
regression passed independently. The final named thirteen-entry Planner and
six-entry SaaS portfolios remain pending on this frozen compiled source.


The first final-lineage portfolio stopped at entry ten, `mutant-receipt`.
Nine preceding entries matched exactly. The receipt mutant failed component
accounting in addition to the intended purchase-lead-time predicate and ten
changed-input probes. Inputs remained stable. Preserve
`planner-final-lineage/portfolio/admission-receipt.json` (SHA-256 `69c1b7604461d547e9f51b9b3e59bf014a001895d77c9303dd032afaa23ed3fb`).
Diagnosis found a fixture typing defect: the mutant retained a raw ISO receipt
date string while inventory formulas compared dates with Excel numeric serials.
The planned fixture-only correction preserves the impossible receipt date but
writes its numeric date value. The verifier and exact failure matrix stay fixed;
focused real-artifact proof and a fresh complete portfolio are required.


SaaS's final replay for suite `911e9db2…` passed all six exact classifications
with authenticated runtime and stable inputs. Versioned receipt:
`saas-admission.json`, SHA-256
`8242cc289ecb9ae66972cc329de602a17f77d12ea40a1de9453980e06d941665`.
Its whole compiled-runner digest is
`sha256:6a364cc0dae69f11a5e072a79bbe1e54400f3808f344bf7b1fcb891133f820ed`.
A Planner reference-builder-only change does not change those scoped inputs.

The real browser run `final-browser-suite-911e9db` passed with explicit all-ten
availability required and the same final suite digest. It exercised ordinary
selection, fixture execution, tab independence, review authority, judge/trace
pages, shutdown/restart, isolated judge context, and screenshot capture.
The outer source snapshot stayed unchanged during the command. Raw-log SHA-256:
`7697eb2c859d1facfe8806ea452fb1983cdb61c3811f5f7f0fe884bb5a6243d3`.
No live provider or paid judge was invoked.

Review erratum: the historical `final-planner-suite-desktop-review-v2.json`
incorrectly says the root-reported 27-test fast run included service, selection,
and run-plan tests. That run included only the suite-manifest, Excalidraw, and
Planner test files. Earlier complete-check results remain scoped to their
recorded source; the final full check is still required. The replacement review
must distinguish source inspection from executed tests, and bind the corrected
Planner builder bytes.


The focused remaining-mutant run (`planner-final-lineage/targeted-mutants.log`)
passed three assertions but failed both dashboard target predicates. This is a
production verifier defect: global metric lookup could read the generic cost
summary total before a stale management total, and render-role discovery could
classify Cost Summary alone as the management dashboard. The existing PRD
requires the actual management/dashboard results and explicitly includes stale
dashboard and broken-rendering mutants. The corrective checkpoint is semantic
view discovery and dashboard-scoped metric reading, retaining layout/name
freedom. A valid cost sheet alone cannot establish a management-dashboard view.
Both actual green workbooks and both dashboard mutants must be reverified;
source identity, suite pins, and whole-dist spreadsheet proof must be refreshed.


Dashboard capacity is a separate required promise in the visible task. The
previous dashboard showed production units but did not establish a reconciled
capacity signal. The repair must observe used/available capacity hours or
utilization against the capacity plan and must reject a stale capacity signal
independently of stale cost. Hours and utilization are alternative reasonable
representations, not a prescribed formula or sheet layout. Complete duplicate
summaries may agree; conflicting summaries cannot silently select the first.

Independent review also corrects the missing-dashboard expectation: deleting
all required summary metrics fails cross-sheet consistency and all ten semantic
changed-input probes as well as the dashboard render role. The former
render-only expectation was unsupported. The precise revised vector is those
twelve failures; other mutant vectors remain unchanged. This adds observation
of existing required promises and does not waive a failed predicate.


The corrected source-current import/extraction checkpoint passed on the declared
Node 24.19 / Artifact Tool 2.8.59 runtime: 1 passed, 21 unselected tests skipped,
24.8 seconds. `planner-dashboard-fix/extraction-scoped2.log` SHA-256:
`f1a80a0eb06cd6eda6ce979f985b3396c6b5e32809853a04ae9c2fd59a445dea`. It covers numeric receipt 53, sparse exception extraction, stale
capacity with valid costs, the transposed alternate dashboard, exact-once
percentage parsing, named/blank/decorative formulas, agreeing duplicate views,
and conflicting duplicate rejection. The failed preceding extraction attempt
is retained. The structural lookup is scoped to dashboard views; ordinary cost
and scenario lookup is unchanged. This focused result does not substitute for
the complete thirteen-entry admission portfolio.

## PR #533 reconciliation with newer main

The first qualified integration was committed as `c537f471a5f1d3a45eb198937d74f8e619c8c8f9`
(tree `28c947935c10df380f30df7c22ee7195ece59a03`) and published as draft PR #533.
Its full check, build, and browser proof passed on stable source manifest
`b5da02b5cc5b35429b4329f266365c64e90284f59abcbfc1a72fdc0e043e1f51`.
GitHub then reported conflicts with newer main. The next integration is pinned
to `b8390ca25b3a73c586136bf6a2438ab95159b2e9`; later upstream changes are not
covered by this proof.

Four conflicts were reconciled: the development-only Eval launcher keeps the
spreadsheet runtime fingerprint; package scripts keep both native-only startup
and all admission commands; architecture documentation retains both contracts;
Node Detail tests retain native Web Crypto observation and disposal assertions.
Luna's 32-file source review is `pr533-merged-upstream-eval-integration-review.json`.
Its initial graph.js concern was retracted after discovering that command had
read the primary checkout. The actual integration contains both upstream Stop
and node-detail asset callbacks. No change was made for that false finding.

The dependency/service update invalidated the Emergency, JupyterLab, Excalidraw,
and three-greenfield receipts. Their named portfolios were replayed. The first
greenfield replay failed 39/40 because Tournament's sealed descriptor still
bound the old EvalService bytes. The source binding was deliberately refreshed
in the TypeScript and JSON manifest, then the normalized verifier, case snapshot,
and immutable suite pin were recomputed. This is a documented candidate-v1
correction before any accepted live baseline, not a behavior-policy relaxation.

Current Tournament snapshot: `sha256:abf5dc17eee9e2537c663c0344704c271403e9d1ca4a30ca7a7472020ecb2bdf`.
Current suite: `sha256:d68baaefb4956528ad8541ac2eb1663a2c639a4e102b9aa02d40ac90241ab038`.
Current compiled Eval runner tree: `sha256:be81c5e8e246ef0e29c88ed65eb52737c018dd4dacbd0d7b334716d5b107b8c3`.
The source/compiled suite parity checkpoint passed 7/7. Whole-dist binding made
fresh SaaS and Planner replays necessary despite their unchanged verifier logic.

Fresh greenfield proof passed 40/40 with stable inputs and no skips on Node
22.23.2. The 39/40 failed receipt remains under
`/Volumes/2T-SSD/eval-evidence/2026-09-27/reservation-tournament-api-main-b8390ca2/`.
A successful report followed by a shell-wrapper error (zsh readonly `status`)
was also preserved; the authoritative v2 rerun captured before/after inputs and
exited cleanly. Fresh Emergency passed 20/20, Excalidraw 13/13, and JupyterLab
10/10. Their receipts are indexed in `ADMISSION_INDEX.json`.

Mac-heavy launches were held while another verification task completed its
bounded attempt. That task's failures are not evidence about this source and
contention was not established as their sole cause. Final repository gates limit
Rust and Vitest test concurrency without changing tests or deadlines. The new
PRD-required `npm run test:eval-compiled-runtime` is verified separately from
default Vitest discovery. Final exact-source gate results belong to the PR.

The live-readiness audit found missing ordinary-suite confirmation, credential
reference, and declared cost-cap fields required by PRD 13.3. The PRD does not
specify the enforcement unit. `LIVE_BASELINE_READINESS.md` records the proposed
repair scope and conditional estimate; no paid run is authorized or claimed.

Final workbook replays: SaaS 6/6 and Planner 13/13 matched every declared vector,
with unchanged captured inputs and the compiled runner digest above. All 99
captured inputs across the ten portfolios matched the reconciled workspace.
