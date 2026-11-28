# PACKTOOK — Atomic Credit Concurrency Test on LOCAL Firestore Emulator

Date 2026-11-28. **New, not operator-executed.** Real Firestore emulator transactions (not a sequential in-memory mock). Script: `functions/tests/tenant-credit-atomic-emulator.cjs`.

Prerequisites: GitHub feature branch checkout as detached worktree, dependencies already available under `functions/node_modules` (or run `npm ci` there if lockfile exists), Firebase CLI, Java runtime for Firestore Emulator.

Strict safety:
- Script refuses execution unless `FIRESTORE_EMULATOR_HOST` is `127.0.0.1:PORT` or `localhost:PORT`, and `GCLOUD_PROJECT`/ `GOOGLE_CLOUD_PROJECT` is the exact demo project `demo-packtook-atomic-v1`. It never discovers/reads Google Cloud credentials or production databases.
- Uses unique synthetic test IDs under `accounts/atomic*` and `operatorMemberships/operator*` **only in the Emulator**, not Staging or Production.
- No function deployments, Cloud IAM, Secrets, signup, payments or cloud writes.
- Does not import or modify `functions/index.js`.

Five scenarios:
1. Two operators' parallel distinct-operation calls compete for **one available credit**: exactly one commit and one credit-exhausted failure.
2. Revocation denies new reservation after membership state is changed.
3. Parallel same-operation retries commit **once** and replay idempotently.
4. Parallel conflicting success/failure finalizations accept exactly one; wallet and reserved count stay correct.
5. Parallel duplicate-barcode overrides race on the **same approval/request**: only one consumes the approved token and credit.

Local run (example):
```bash
cd ~/packtook-p23173 || exit 1
git fetch origin feature/fast-track-operator-workflow-candidate || exit 1
DIR="$(mktemp -d /tmp/packtook-atomic-emulator-XXXXXX)"
git worktree add --detach "$DIR" FETCH_HEAD || exit 1
cd "$DIR" || exit 1
node --check functions/tests/tenant-credit-atomic-emulator.cjs || exit 1
# npm install under functions/ is optional only when dependencies are absent,
# and does not touch Cloud; prefer existing lockfile and npm ci.
# Verify local prerequisites BEFORE starting emulator.
test -d functions/node_modules/firebase-admin || { echo "MISSING_LOCAL_FIREBASE_ADMIN"; exit 2; }
firebase emulators:exec --only firestore --project demo-packtook-atomic-v1 \
  'node functions/tests/tenant-credit-atomic-emulator.cjs'
RESULT=$?
echo "PACKTOOK_FIRESTORE_EMULATOR_EXIT=$RESULT"
echo "PACKTOOK_FULL_PUBLIC=NO_GO"
```

Expected only if all five passes confirmed: `PACKTOOK_FIRESTORE_EMULATOR_CONCURRENCY=5/5_PASS`, exit 0. A failing emulator assertion is meaningful evidence and must be diagnosed, not bypassed.

**Limits:** This test uses injected handlers directly, not Firebase HTTPS/onCall invocation and not a fully integrated browser/owner/operator workflow. It does not validate operator bootstrap, real device registration, monthly period transitions, payment, or Cloud staging App Check. The eight operator callables are still not wired to `functions/index.js`, and production release remains `NO_GO`.
