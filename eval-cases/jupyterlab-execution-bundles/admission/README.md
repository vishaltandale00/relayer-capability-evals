# JupyterLab execution-bundles admission v1

Run `npm run eval:admit:jupyterlab-execution-bundles` with absolute, durable
`RELAYER_JUPYTERLAB_ADMISSION_ROOT` and `RELAYER_JUPYTERLAB_SOURCE_CACHE`
paths. The runner requires macOS arm64 and Node 22.23.2, authenticates the
pinned commit/tree and protected Yarn/configuration bytes through the production
materializer, and invokes the production grader without `testOnly` shortcuts.
The declared npm entrypoint first runs `build:packages`; direct script invocation
does not establish the source-to-compiled-runtime boundary required for an
admission receipt.

The portfolio reports the genuinely untouched baseline as delivery-ineligible
without manufacturing an empty commit. A separate committed missing-feature
control proves the public seam is red while its build, clean-delivery, and
pristine-delta prerequisites remain green. Both sealed green patches must pass
every check. Semantic mutants omit execution evidence, accept missing inputs,
hide partial execution, or detach UI status; each must fail its named predicate
while build and delivery prerequisites remain green. Authority mutants alter a
protected configuration file or mutate the staged delta during the upstream
test, and must fail the corresponding protected-source or final pristine-delta
boundary. Delivery-eligible members are one substantive commit on the pinned
fixture. The grader rematerializes each eligible delta into a pristine checkout, performs
the immutable install, scoped notebook/testing builds, focused upstream and
sealed public-export tests, twelve behavioral predicates, and the final
protected-byte/staged-delta integrity check.

The runner writes one JSON result per member plus `receipt.json`, binding the
case snapshot, verifier, upstream commit/tree, environment, patch digests, and a
source-input digest. It preserves all member workspaces, including failures and
partial runs. Reusing a nonempty admission root fails closed so earlier evidence
is not overwritten.

The solution README's earlier two-green statement is historical narrative. It
is not a current admission receipt. Only a successful v1 runner receipt against
the exact source inputs can support a current admission claim.
