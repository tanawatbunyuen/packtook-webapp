# V4 Billing Lock Mismatch — Read-only Triage

Current confirmed operator result: `REAL_OMISE_TEST_CHARGE_READ: PASS`, `STAGING_BILLING_LINKAGE: BILLING_LOCK_NOT_MATCHED`, `CLOUD_WRITES: 0`. The Omise Test charge is a paid Business charge for THB 1290. Existing read-only checks confirmed the requested billing record's charge ID, account ownership and plan match. The lock field `accounts/{uid}.openBillingRequestId` does not point at the charge's `requestId`.

Never force the account billing lock to point to a historical paid charge: this may incorrectly activate an expired or superseded purchase, credit the wrong subscription, or duplicate credit. The real `functions/index.js` `reconcileCharge` uses `lockOk` and `billingVersion` gates. Existing `status:paid` is idempotent and a missing lock is normal after successful settlement (lock removed).

## Read-only diagnosis
From a reviewed isolated worktree (no deploy):
```bash
gcloud config set project packtook-staging
export RR_STAGING_PROJECT_ID=packtook-staging
python3 production/scripts/rr-v4-staging-lock-diagnostic-readonly.py
```

The script reads the Omise Test Charge and at most three Firestore documents via GET only. No raw response, owner UID, billing request ID or credential is printed. Outputs a category such as `BILLING_REQUEST_ALREADY_COMPLETED`, `BILLING_REQUEST_REQUIRES_REVIEW`, `LOCK_MISSING`, `LOCK_POINTS_TO_ACTIVE_REQUEST`, `LOCK_POINTS_TO_DIFFERENT_REQUEST`, `BILLING_VERSION_MISMATCH` or `PENDING_VIDEO_RESERVATIONS`. Even MATCH never authorizes a payment/credit write.

If already paid, audit existing wallet ledger and ensure no duplicate grant; **do not** recreate a lock. If another request is active, preserve it and manually review the earlier charge. If no lock, inspect expiry/billing history before any manual settlement plan. If missing account or billing document, do not create it automatically.

No Cloud Run re-execution needed to diagnose lock; V3 read-only charge retrieval already passed. No Staging writes approved and Production/Public remain closed.

**NO_GO_RELEASE.**
