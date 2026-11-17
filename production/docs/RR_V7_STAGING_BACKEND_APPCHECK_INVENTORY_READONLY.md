# PACKTOOK V7 — Staging Deployed Backend App Check Inventory

Context: deployed Staging Hosting Bridge is tagged v7.3.6-staging-key and contains Firebase App Check initialization, unlike the review branch's older Staging bridge. The 27 callable API names match, but the source of the deployed Cloud Functions and App Check enforcement are NOT established by matching names.

## How to run (operator, read-only)
From the reviewed V7 branch in Cloud Shell:

```bash
gcloud config set project packtook-staging
export RR_STAGING_PROJECT_ID=packtook-staging
python3 -m unittest -v production/scripts/test-rr-v7-staging-backend-appcheck-inventory-readonly.py
python3 production/scripts/rr-v7-staging-backend-appcheck-inventory-readonly.py
```

This script uses `gcloud functions describe --gen2 --project=packtook-staging --region=asia-southeast1 --format=json` on exactly five named Functions: reserveCredit, finalizeCredit, recordingStatus, recoverStaleVideoReservation, usageStatus. It only prints state, metadata presence and sanitized counts. No request to any callable endpoint, and no environment variables or service account details are displayed.

## Interpretation
- A `FOUND/ACTIVE` response confirms existence/operational state only.
- **Cloud Functions describe does not establish that the deployed callable handler was built with `enforceAppCheck: true`.** Treat enforcement as NOT_VERIFIED even if all five functions are ACTIVE.
- The review branch's common callable `options` has no `enforceAppCheck` setting; per-callable overrides, other branches, deployed revisions, and operator-side changes require separate verification.
- Firebase documentation confirms that enforcement must be set in the callable's runtime options and deployed. Presence of a JavaScript App Check client SDK alone is NOT backend enforcement.
- Production is excluded; do not copy Production's Firebase config or API keys into Staging.
- No uncredentialed probe against mutable callable functions: even if endpoint unauthorized, an accidental successful request could change credits.
- A separate authorized negative-token validation plan should use a purpose-built no-write probe and prior inspection of deployed source/observability, not `reserveCredit` or `finalizeCredit` on a customer wallet.

## Release gate
Hosting asset parity remains BLOCKED_DRIFT. Gate B/C NOT AUTHORIZED. Production release NO_GO; no deploy, no Staging Firestore writes, no Omise calls.
