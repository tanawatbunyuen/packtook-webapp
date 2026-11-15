# PACKTOOK: Cloud Run V3 - paid Business Test charge replacement

V3 image pinned digest: `sha256:1fbbf58ed4e89eea63694300a328bbde3b0187ac49042295b13239f9bf6b10b1`.

New read-only test charge `chrg_test_69iy4us7mfk2o5p2qfu`: user confirmed via Omise Dashboard Test Mode Business 30 days for THB 1290, and via a direct GET /charges: HTTP 200, ID/amount/currency/paid/test mode match, metadata fields exist. This user-confirmed direct GET is not yet a Cloud Run V3 PASS.

Safeguard: first verify the current V3 image, fixed Staging service account, mounted secret version 1, old charge/amount, disabled Production writes, public signup closed, retries zero, task count one, and correct project. Independently retrieve the new charge from the actual Omise TEST API using the Staging secret version 1; ensure exact new ID, successful AND paid, THB, 129000 satang, livemode false, and valid uid/requestId metadata. No secrets, metadata or charge response bodies are printed. By default, **dry run**. Explicit --apply updates only the four expected-charge env variables on the existing Staging Cloud Run Job; no Job execution or Production changes.

From an isolated worktree with the reviewed commit, e.g. `~/packtook-omise-v3-business`:
```bash
gcloud config set project packtook-staging
export RR_STAGING_PROJECT_ID=packtook-staging
python3 production/scripts/rr-switch-omise-v3-business-charge.py
# After STAGING_JOB_PRECHECK + REAL_OMISE_TEST_CHARGE_READ + IMAGE_V3_PINNED PASS:
export RR_CONFIRM_STAGING_CHARGE_SWITCH=SWITCH_PACKTOOK_STAGING_V3_TEST_CHARGE_ONLY
python3 production/scripts/rr-switch-omise-v3-business-charge.py --apply
```
Then inspect the Job without displaying secrets, verify only four expectation values changed and V3 digest remains, then execute one single authorized GET via:
```bash
gcloud run jobs execute packtook-omise-test-probe --project=packtook-staging --region=asia-southeast1 --wait
```
Read the **new** execution ID logs; expect `OMISE_TEST_READ_ONLY_VERIFIED: PASS`, `PRODUCTION_WRITES: 0`, `RELEASE_DECISION: NO_GO_RELEASE`. If any guard fails, do not run the Job.

Crucial: This only proves V3 **read-only charge retrieval with matching metadata**, not that Charge metadata maps to an existing Firestore billing request or that the production Billing Handler activation is correct. Never grant wallet credits with this command. Original historical charge `chrg_test_69jkgjiaft9zvl2pzst` remains HTTP 404/not_found. **NO_GO_RELEASE / PUBLIC CLOSED.**
