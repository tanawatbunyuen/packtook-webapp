# P231.175 — Independent offline verification of P231.174 source snapshot

## Observed operator evidence from P231.174
- Source inventory 12 entries, baseline nonconfig hash `1a3319c9890db096807383841f2cc03b1e5301671201c1177a56cf3812727098`.
- The two deterministic ZIP builds matched and roundtrip bytes passed; exit code 0.
- Archive SHA-256 `11e6fbb680c5c774b5384aea41159d44d8ee0e209292c6cddc51aca3889bea69`.
- Manifest SHA-256 `7da53cb21ee0b41a43c972a2c703860833334622e2f2a20e96c8848051068789`.
- Both files exist in the **temporary Cloud Shell environment** at `/tmp/packtook-p231174-review-only/`. This directory is **not durable archival storage** and may disappear.

## What P231.175 adds
`audit/p231/isolated-test/p231175-verify-review-artifact-integrity.py` reads the **persisted bytes from disk**, rather than trusting the builder in P231.174.
- Requires the two previously observed top-level SHA-256 pins and the manifest's 12 file entries.
- Rejects symlinked artifact paths, unexpected paths, duplicated entries, oversized entries, changed release approval flags, mismatched record/member hashes, and changed non-config source baseline.
- Performs three safe in-memory integrity checks: the unmodified evidence must validate; a copied ZIP with one changed byte must be rejected; a copied manifest with a changed member hash must be rejected. Copies are **not written back to disk**.
- Prints only counts and pass/fail booleans, never JS source, config, site key values, tokens, per-file source, or ZIP contents.
- Does not install browsers, call Firebase APIs, perform source writes or deploy.

**A passing exit 0 proves the local artifact's pinned bytes match and integrity checks work; it does not prove this ZIP is a deployable candidate, or constitute a Hosting rollback backup.** The checked-in site key remains blank and the index is not reconciled. Real candidate browser runtime, Firebase CLI packaging parity, and authorized test origin remain outstanding.

## Next engineering decision
After P231.175, focus on preparing a *separately governed* staging-only candidate and an isolated browser test harness. Avoid repeated archive checks with little new evidence. Any registered-origin App Check test/preview channel, real callable/Auth interaction, Hosting release or rollback requires a separately scoped decision and authorization. Production remains NO_GO.

P231175_INDEPENDENT_ARTIFACT_VERIFICATION=AWAITING_OPERATOR_RESULT
P231175_DEPLOYABLE_ARTIFACT=NO
P231175_RELEASE=NO_GO
