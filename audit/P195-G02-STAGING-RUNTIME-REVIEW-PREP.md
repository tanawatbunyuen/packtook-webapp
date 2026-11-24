# P195 — G02 Staging Runtime Evidence & Independent Security Review Preparation

**Review-only; G02 NO_GO, release NO_GO, deployment NO_GO, public signup CLOSED.**

## Scope
P195 reconciles sanitized **operator-generated staging evidence metadata**, pins it to the exact P188 full-backend candidate SHA256 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b` and the staging usageStatus callable. It rejects production project mixups, URL substitution, stale or future captures, revision mismatch across runtime and App Check probe, failed positive/negative App Check behavior, incomplete inventories and unresolved Auth lookups or Owner conflicts.

The code intentionally cannot attest that `candidateSha256` corresponds to what is **actually deployed**. For that, an independent Security Reviewer must verify the deployed source/build provenance and revision against protected Cloud Build/Cloud Run/Firebase records, not merely accept the operator's metadata.

## Operator workflow — staging only, authorized read-only
1. An independently authorized Cloud Operator examines **read-only** GCP resource metadata for `projects/packtook-staging/locations/asia-southeast1/functions/usageStatus`, records active Revision/Runtime, verifies the callable HTTPS origin independently and captures a protected read-only artifact. No CI credentials or user secrets.
2. Use P186 `audit/p186-g02-operator-cli.js` to gather **staging** aggregate-only Auth+Firestore account inventory with bounded scan and no Auth lookup errors. The operator must first independently authorize and audit its read permissions. Owner provenance cannot be proven by aggregate counters.
3. Use P187 `audit/p187-staging-appcheck-cli.js` with real authorized staging Firebase Auth/App Check tokens from the legitimate staging application flow. Ensure missing-token rejection and valid-token acceptance on the exact function/revision; do not expose any tokens or raw response bodies.
4. Independent Security Reviewer checks staging revision provenance, code review of exact six changes, protection of backend and App Check verification, IAM/permissions and nonproduction regression proofs. Obtain a protected signoff outside the repository.
5. Prepare a **small sanitized local metadata JSON document** with four top-level records: `runtime`, `inventory`, `appCheck`, `securityReview`. Use only fields allowed in `audit/p195/reconcile.js`; do not place IDs, emails, Access/Refresh tokens, Service Account credentials, raw reports, user lists, or signoff documents in GitHub, CI logs or chat. A document hash is a reference, not a digital signature.
6. On an approved workstation **outside CI**, optionally run `node audit/p195/cli.js <sanitized-metadata.json>`. The CLI prints only state classifications and still returns NO_GO. It never launches a cloud call.

## Five outstanding external P190 requirements
- Staging real account inventory (P186)
- Production real account inventory (separate authorization; **P195 never does it**)
- Valid App Check acceptance and missing-token rejection in real staging (P187)
- Historical independent owner provenance and remediation plan
- Independent Security Reviewer signoff on exact release diff

A staging observation does not replace production inventory or staging deploy authorization. The code samples / CI do not prove actual staging IAM, App Check or code provenance. Even four apparently valid staging metadata claims result in zero independently verified claims and **NO_GO**.

## CI
Executes offline negatives and P189 pinned source full-backend reconstruction, P190 evidence preflight and historical P172/P180 NO_GO. Does not invoke Cloud SDK, Firebase staging or production, or install Cloud credentials.
