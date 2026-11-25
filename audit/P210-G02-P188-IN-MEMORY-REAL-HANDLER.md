# P210 — G02 Real P188 Handler In-Memory Authorization Test

**Purpose**: go beyond string-source comparison. The test harness executes the **actual pinned P188 candidate JavaScript module** via Node VM with all Firebase Admin, Functions and Firestore calls replaced by deterministic in-memory stand-ins. No emulator process, no Firebase Admin credential and no remote network.

The test verifies behavior of:
- `accountRole`: only explicit `ownerUid` user gets role `admin`, missing/foreign/legacy unowned accounts denied with no writes; missing Auth and unverified email denied.
- `authorizeDuplicate`: explicit owner with completed barcode lock can approve; missing/foreign owner, nonexistent account, missing barcode lock, weak reason and unauthenticated request denied **before** any simulated writes; unowned legacy account not auto-backfilled.
- `usageStatus`: new account initialized with explicit `ownerUid`, old account without owner remains unmodified, and tenant-scoped doc selection is preserved.

The source integrity is bound to isolated P188 candidate sha256 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b` and the P189 exact six-edit build diff checker. Any emitted test PASS is **only an in-memory behavioral check**, not a production Firebase Auth token test, Firestore emulator test, App Check enforcement test, runtime deployment attestation, or Independent Security signoff.

**Still blocks G02_BACKEND_AUTH:** independent security review, real Firebase emulator integration + actual auth boundary testing, complete legacy-account provenance/tenant review, verified deployed P188 source and positive/negative staging runtime evidence. **G02 NO_GO; 8/8 release gates NO_GO.** No deploy/merge/migration/owner import or public signup.
