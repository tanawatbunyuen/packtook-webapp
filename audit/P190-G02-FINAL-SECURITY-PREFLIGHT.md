# P190 — Final G02 Security Preflight & External Evidence Reconciliation

**STATUS: NO_GO_G02, NO_GO_RELEASE, NO_GO_DEPLOY, KEEP_PUBLIC_SIGNUP_CLOSED.**

## What P190 adds
- P189 independently reconstructed and SHA256-pinned the isolated backend release candidate from six known edits, with 23/23 export parity and 6/6 negative mutation defenses. P188's Auth/Functions/Firestore callable tests were 21/21 PASS. These are **offline/demo-only evidence**.
- P190 adds a strict offline reconciler `audit/p190/reconcile.js`, which rejects wrong project, stale/future evidence, unexpected metadata (including PII fields), wrong candidate hash, malformed artifact digest, unresolved account lookups, truncated account inventory, unreviewed legacy provenance and unapproved diff metadata.
- The reconciler deliberately treats *all* operator-supplied evidence metadata as **unverified assertions**. A ticket string, document hash, reviewer role claim or self-attested approval is NOT an actual third-party identity/cryptographic signature verification. Even with all metadata supplied, it returns G02 NO_GO until an independently verified reviewer checks evidence out of band.

## Outstanding external proof in priority order
1. P186 staging **and production** account inventory collected separately by an authorized Cloud Operator using exact-project least-privilege read-only IAM. A `complete:true` scan and `authLookupErrors:0` are mandatory. Never include account IDs/emails in PR comments or logs.
2. P187 valid staging Firebase App Check token accepted on exact owner-verified staging Callable URL, without-token request denied; capture protected artifact and runtime revision, NOT the tokens.
3. All missing/ambiguous `ownerUid` cases independently reconciled with enrollment provenance; manual review and reversible plan for any migration. No automatic migration.
4. Human Security Reviewer verifies evidence, SDK provenance, exact pinned six-diff Release Candidate, critical payment/credit/authorization regression and staging runtime consistency. Sign-off must remain external to repository self-declarations.

## Audit package
- **Original functions git blob** `92262ea2fbbb941188937d72f0eea74a735d2bf3`.
- **Generated P188 candidate SHA256** `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b`.
- **Draft review chain** P183 #185, P184 #186, P185 #187, P186 #188, P187 #189, P188 #190, P189 #191.
- **Five external evidence requirements**, all missing as of this preflight: staging inventory, production inventory, real App Check, independent owner provenance/remediation, independent exact diff sign-off.

P190 CI has no cloud secrets or live project access and runs only the reconciler with **missing evidence** plus synthetic negative tests. The CLI refuses loading any external evidence file in CI. Outside CI, it accepts only a small local JSON metadata file (no user information/tokens) which stays in the operator's protected workstation; do not commit real evidence to GitHub.

The reconciler is a *triage and integrity preflight*, not a proof of a secure deployment. Do not merge, enable signup, import recovered Owner code, deploy or migrate based on P190 results.
