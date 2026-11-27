# Gate A4 / C1 — PACKTOOK rollback and recovery readiness (plan only)

**Status 2026-11-27:** `NOT_EXERCISED`, `NO_GO_FULL_PUBLIC`. This runbook is a review artifact and DOES NOT authorize a rollback, deployment, IAM change or public signup modification.

## Immutable evidence and scope
- Observed staging Hosting live release at historical check: `sites/packtook-staging/channels/live/releases/1794125129869000`.
- Associated version: `sites/packtook-staging/versions/840e12c0c88d8c1c`, finalized at `2026-11-08T08:05:29.869Z`.
- Historical metadata pin: `audit/p231/isolated-test/p231164-staging-live-release-pin.json`.
- Review-only Candidate ZIP SHA-256: `ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2`. It is **not** an approved recovery image.
- **Do not assume** the historical live version remains the current version or can be restored merely because the metadata API returned FINALIZED. Verify fresh release metadata and eligible recovery path before any change.
- `firebase.json` includes Firestore and Functions in addition to Hosting. **Never run broad `firebase deploy` for this operation**.

## Preconditions for a separately authorized rehearsal
1. Owner grants written, time-bounded authorization naming **project, site, Hosting channel, origin, operator, actions and target recovery version**, with explicit prohibition on production if staging-only.
2. A second reviewer confirms authorized identity, current live version and immutable source pin; capture metadata without exposing credentials or secrets.
3. Capture supported snapshot / version history and establish current deploy/rollback behavior against Firebase documentation for the installed CLI or API. A version ID alone is not a disaster-recovery backup; have a validated recoverable source build.
4. Record baseline metrics: 200 app shell, hash of key assets, Auth/App Check failure rates, Functions errors, recovery time objective and allowable data impact.
5. Explicitly decide how public signup remains closed throughout staging exercise; rollback of Hosting must not be assumed to revert Functions, Firestore rules, credits or Auth configuration.

## Rehearsal outline (not commands to execute now)
- **Prepare:** use dedicated isolated staging Hosting channel and a previously verified recovery build where possible; do not change the live channel as part of an unapproved dry run.
- **Exercise:** with scoped approval, deploy only the approved Hosting artifact to the authorized isolated channel, run a read-only smoke, revert to the pinned recovery artifact using a supported operation, and run smoke again.
- **Verify:** version/release lineage, HTTP status, static asset hashes, App Check client behavior and incident telemetry match intended baseline. Retain redacted signed evidence and timestamps.
- **If anything mismatches:** stop, disable progression, use incident runbook, do not try unreviewed Functions/Firestore/IAM writes.
- **Close:** record tested operation and independent witness, recovery elapsed time, residual risks, monitoring signals and whether C1 criteria are actually satisfied.

## Production cutover criteria
- Gate A and Gate B PASS on the **exact approved immutable candidate**, including registered-origin real App Check and secured credit/payment operations.
- Privacy/PDPA, support, finance, account abuse and cost controls reviewed, on-call staffed and monitored.
- Separate approvals for production Hosting operation and **public signup enablement**. If either approval is missing, stop and leave Full Public `NO_GO`.
- Post-release detection and rollback thresholds pre-agreed; ensure configuration/domain/credentials are not coupled to staging.

## Gate decision
A4 is **RUNBOOK_PREPARED_ONLY**, not PASS. An approved dry-run/rollback proof remains outstanding. C1 is also not PASS.

No live rollback or deployment performed by the creation of this file.
