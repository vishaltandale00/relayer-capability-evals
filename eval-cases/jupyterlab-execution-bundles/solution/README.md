# Sealed reference: JupyterLab execution bundles v1

This evaluator-only note describes behavioral solution families; it is not exposed to the candidate and the verifier does not compare source or patches.

Two independently implemented solutions satisfy the public contract used by admission tests:

1. A browser-oriented implementation uses Web Crypto `SubtleCrypto` and a direct recursive canonical JSON writer, embeds referenced bytes as base64, and defensively clones then freezes the imported bundle.
2. A second browser-oriented implementation first normalizes objects into sorted-key records and then uses native `JSON.stringify`, while retaining an independently structured import and comparison path with the same public behavior.

Both preserve environment identity, ordered executions and outputs; hash every referenced file and the complete unsigned bundle; reject tampering and missing inputs; distinguish partial execution; compare reruns without timestamps; and attach every read-only UI status to a supplied notebook host.

The adversarial portfolio mutates the public behavior rather than matching candidate source. It includes an integrity implementation that omits execution evidence, an import that accepts missing files, an import that hides partial execution, and status projections that either make evidence editable or leave it detached from the supplied host. A separate transport mutant attempts to forge verifier receipts and exit. Each mutant must fail its relevant independent predicate.

The frozen alternatives are `green-recursive.patch` and `green-normalized.patch`. Both apply to pinned JupyterLab commit `9a217d024d13ef82c8de060a9fed8b430d28424a`. On Node 22.23.2, each passed the scoped `@jupyterlab/notebook` build, its focused upstream Jest test, the evaluator-owned public-export Jest test, and all 18 independent workspace checks, including a post-execution proof that protected configuration and the staged candidate delta remained unchanged in a pristine evaluator checkout. The first patch uses recursive canonical serialization and recursive freezing; the second uses normalized records, iterative freezing, and sequential file assembly.
