# P205 — G02 Evidence Gap Closure Plan & Offline Review Dashboard

**Status: REVIEW_ONLY, NO_GO_G02, NO_GO_RELEASE, NO_GO_DEPLOY, KEEP_PUBLIC_SIGNUP_CLOSED.**

## Purpose
Make remaining independent review work actionable without pretending offline metadata or an operator's self-asserted approval proves cloud runtime security.

The new `audit/p205/dashboard.js` renders a five-lane tracker sourced from the canonical P190 requirements and the P204 untrusted-metadata intake. Each lane shows responsible *role*, exact project, required proof, authorization prerequisites, missing vs submitted-unverified vs rejected, and next action.

The five evidence gaps remain:
1. Staging Auth+Firestore legacy inventory (Staging read-only operator, independent check of complete aggregates)
2. Production Auth+Firestore legacy inventory (separate, explicit Production READ authority required)
3. Real Staging App Check (positive/negative with legitimate tokens and pinned usageStatus revision)
4. Owner provenance remediation (independent audit, no legacy owner autogrant/backfill/import)
5. Exact P188 candidate security signoff (source ZIP/build-to-revision image linkage and six-edit diff)

## Baseline facts and limits
Operator-provided Build SUCCESS and Cloud Run revision READY describe the 2026-11-07 staging deployment, **not** the post-November P188 candidate. The artifact registry showed the 7-day DELETE/ANY rule; missing versions and empty BatchDeleteVersions logs are inconclusive for exact deletion causality. The Cloud Build output image digest remains absent from provided evidence.

No production query is authorized by this plan. Never upload raw source ZIP, customer email/UID, API tokens, keys, sensitive IAM, or Omise data to CI, PR or chat.

## How to render offline
```bash
node audit/p205/cli.js
```
An independently authorized operator can optionally supply a local sanitized JSON file shaped as `{ "submissions": [], "claims": {}, "asOf": "..." }`. The CLI rejects arbitrary external evidence in CI, symlink/oversized files, and unknown root fields. The report is Markdown and can be copied to a private operator review document. It is **not** a persisted live monitoring dashboard or an authenticating system.

## Trust boundary
`SUBMITTED_UNVERIFIED` counts only metadata that P204 syntax validates. No submitted evidence may change `independentlyVerified: 0`, `NO_GO`, production access authority, or public signup. External independent security reviewer approval must occur outside this software and require protected authenticated evidence.

No Cloud API calls, IAM changes, Deploy, Merge, Migration, or Cleanup Policy changes.
