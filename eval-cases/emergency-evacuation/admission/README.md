# Emergency evacuation authority evidence

The Emergency Evacuation Route Planner remains a `candidate`. This note records
the pinned runtime and deterministic authority checkpoints; it is not an
admission receipt or a promotion claim.

## Runtime identity

Qualification requires the standalone macOS arm64 Node executable at version
`22.23.2` with SHA-256
`18e387c90ab8a8400183e8bdd396376e1e875b91b4c874b894dcade7b35bf572`. The
expected identity participates in the case environment digest. Preflight hashes
the resolved regular-file bytes before starting that executable, then checks
its self-reported version, platform, architecture, and resolved executable path.
The preflight receipt reports the version, platform, architecture, executable
digest, and environment digest without persisting the host-specific path.

The verifier records the authenticated runtime as the mandatory
`runtime-authority` predicate. Its Seatbelt profile grants file reads to the
exact executable and required system paths; it does not expose the containing
Node installation tree.

## Dependency authority

The pristine candidate delta is checked for third-party declarations, bundled
dependencies, and vendored `node_modules` before invoking the candidate CLI. A
policy failure keeps its own failed predicate and marks scenario checks failed
with the reason that candidate execution was withheld. The focused test asserts
that no sandboxed candidate process starts for a forbidden dependency.

## Proof boundary

The integrated source currently binds normalized verifier source SHA-256
`94e8cc2d71fde7843642075e7c460fb58d691365ba6d05e38160aeac16c24084`,
verifier identity
`sha256:7de6458c6d92601eeb90f6de47634cbb8fc27371a3c3e79603501a14d643d415`,
and case snapshot
`sha256:c83982a66344165475a7c03b491369c4721dd9bf1b4834d5ee166d59cb753658`.

A historical macOS arm64 focused run passed 19 of 19 Emergency tests after the
package build. That run applies only to normalized source
`77ad9581eb929732b3380614f9546f10fadf6416aef988c5f54fe0bc83b17726`,
verifier identity
`sha256:87c7fa6a11716016bb5e2176d3d8bd040b617db62bcac78da4e5f6a67e0cab3f`,
case snapshot
`sha256:3ee60e074e034fff4e4b29f8b2bab08bfb66de6e72121f7e6b491b22925c2525`,
and environment
`sha256:9e4bdbd2fc03b19c24843b8480c5f4ff8348765accbba7d8cdada0104aebae11`.
The subsequent type-import and integration changes invalidated that result for
the current source; it remains historical evidence rather than current
qualification.

The focused verifier suite is
`packages/capability-evals/test/emergency-evacuation-case.test.ts`. Runtime-dependent
checks run only when an independent test-side check confirms the exact pinned
Node binary and macOS sandbox are available. Portable source-digest and
wrong-binary rejection checks remain active on other hosts; their skipped
runtime qualification is not a pass.

There is no declared Emergency admission runner in the package scripts or
evidence portfolio in the historical snapshot described above. The repository
now declares `npm run eval:admit:emergency-evacuation`. It requires an empty,
durable `RELAYER_EMERGENCY_ADMISSION_ROOT`, independently authenticates the
exact Node executable and sandbox availability, and runs the existing real case
portfolio through Vitest's JSON reporter. Admission requires every named
baseline, two-green, mutant, containment, dependency, secret-boundary, and
runtime-authority checkpoint to pass with zero skipped tests. The runner binds
the source, test, both solver fixtures, lockfile, runner, case snapshot,
verifier, and runtime digests; it preserves the raw log, JSON report, and an
explicit `passed`, `failed`, or `unavailable` receipt. The outer process exit
code alone is never treated as admission.

The integrated source was qualified by the declared runner on 2026-09-27. The
20 required assertions passed with no skips, and the bound inputs were stable.
The durable receipt is
`/Volumes/2T-SSD/eval-evidence/2026-09-27/emergency-admission-v3/receipt.json`
(`sha256:830a0d00f5f56e596285425f579ee030b99adea41846d1c460b6ab83f59bfa04`).
The raw Vitest log and JSON report remain beside it. This receipt qualifies only
the exact source identities recorded in that receipt; the case remains a
candidate pending the complete suite decision.
