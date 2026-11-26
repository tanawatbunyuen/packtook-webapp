# P231.165 — Offline candidate integrity manifest and rollback readiness

## Observed P231.164 result
Operator reported `P231164_PIN_EXIT_CODE=0`, `P231_API_RESULT=HTTP_200_3_GET`, and `P231_PIN_METADATA_VALIDATED=PASS`: the pinned release/version resource matches the current live channel of `packtook-staging`; the Version status is `FINALIZED` and the release timestamp matches. There were no cloud writes, deploys, or access-token prints. **This is metadata validation only**, not a tested rollback or a completed backup.

Pinned staging live reference is maintained in `audit/p231/isolated-test/p231164-staging-live-release-pin.json` (non-secret resource IDs). A later deployment can make this pin no longer current. Validate again before any approved publish.

## P231.165 new offline manifest
`audit/p231/isolated-test/p231165-offline-candidate-integrity-readiness.py` uses **local files only**. It validates the P231.164 pin, no-approval/no-rollback claims, Hosting source directory and Index's five versioned script references. It computes a deterministic SHA-256 aggregate of the bytes of **six non-config repository assets** (Index, Bridge, and the four non-Bridge JavaScript files). This digest is printed as a local-source inventory fingerprint, **not** a complete staging Hosting manifest or immutable deployable candidate fingerprint.

Public `firebase-v4-config.js` is excluded from the fingerprint because its checked-in site key is intentionally empty; a complete candidate artifact can only be fingerprinted **after** a reviewed staging-specific public-key provisioning/build process and full Hosting source inventory. This script never prints or copies public site keys, credential values, or source text. It creates no files and makes zero HTTP/Cloud API requests.

A successful exit 0 means the **offline inventory measurement was completed**, not that Rollback or Hosting Release gates passed.

## Recovery runbook decision points
1. **Baseline**: Confirm the pinned current staging live release/version with the GET-only P231.164 verifier immediately before an authorized Hosting-only deployment. If changed, stop and re-review the baseline.
2. **Source reconciliation**: Resolve index script version alignment and Bridge/Config runtime behavior. Current hosted `usageStatus` App Check/Auth header and HTTP 200 observations do not prove a candidate build behaves identically.
3. **Complete candidate**: Build a persistent, isolated and reviewed staging-only Hosting artifact with a correctly provisioned public Enterprise site key; validate all hosted assets, not just six fingerprints. Never commit Admin/secret credentials.
4. **Recovery**: Validate a supported Firebase Hosting rollback workflow and ability to restore the pinned version; prepare a complete rollback artifact/procedure before a risky deployment. Merely having a `FINALIZED` version resource does not prove recovery.
5. **Approval and smoke**: Obtain explicitly scoped staging Hosting deployment authorization, validate failure triggers and a revert plan; after an authorized deploy, test normal client App Check header/HTTP on read-only status and ensure public signup stays closed. Production remains NO_GO.

This phase is offline only and makes no Cloud Functions, Firestore, Hosting Admin, Firebase Auth, App Check, credit/billing, IAM, deployment or cleanup changes.

P231165_OFFLINE_INVENTORY=PREPARED_AWAITING_OPERATOR_RESULT
P231165_ROLLBACK_VERIFIED=NO
P231165_HOSTING_DEPLOY=BLOCKED
P231165_RELEASE=NO_GO
