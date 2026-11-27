# Gate A consolidated independent candidate verification — Full Public Fast Track

## Confirmed operator result
2026-11-27 operator report: complete Gate A *review-only* candidate assembled from 12 local Hosting files. ZIP reproducible and roundtrip valid; source commit pinned; local fail-closed bridge unchanged and hosted Index query versions adopted. Archive SHA-256 `ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2`, manifest SHA-256 `91f2c2d3b0b313cb1c777966213622550be9becdb5034d87f5b75c6d0ca57f2a`. Exit 0, three **public static asset GETs** only, no deploy or public signup change.

## Action consolidated, not another per-phase audit
`gate-a-independent-candidate-verifier.py` independently reopens ZIP/Manifest from `/tmp/packtook-fast-track-gate-a-review/`. It validates operator-observed SHA-256 pins, all 12 per-file hashes, no duplicated/traversal ZIP paths, precise source commit, unchanged local Bridge, and checks candidate Config differs from local version **only** by public staging site-key injection. It ensures all release-authority flags are false. It records which four Gate A checks are still missing and reports no GO.

This script is **offline** and makes zero network requests. A result of `INDEPENDENT_ARTIFACT_EVIDENCE=PASS_REVIEW_ONLY` is strictly an artifact-integrity result, not Gate A PASS. The files remain in /tmp, so absence after Cloud Shell environment reset is an expected blocker, not a reason to bypass verification.

## Specific remaining Gate A work
- A1 **Semantic source review**: Compare repo guarded Bridge to Hosted Bridge, decide which implementation is canonical, review App Check initialisation and domain/key ownership, plus Auth and status-call error behavior. A mechanically constructed candidate does NOT mean code review signed off.
- A2 **Official Firebase CLI packaging equivalence**: Run a non-deploying official CLI config/packaging check against the exact Candidate, review all 12 files, and pin the completed artifact. Do not run `firebase deploy` or upload.
- A3 **Real browser**: Install/provision disposable browser runner on separately approved workstation/test sandbox, mock external requests for initial smoke. Genuine registered-origin App Check remains a separate staging operation needing specific authorization.
- A4 **Rollback rehearsal**: Prepare/verify supported recovery path (not simply a version ID); do not exercise real Hosting rollback without scoped approval.

## Owner decision
No staging/prod deploy; no preview Hosting channel; no IAM/Secrets change; no signup enablement; no business billing/credit calls. Gate A **BLOCKED**, B and C **NOT EXECUTED**, Full Public **NO_GO**.
