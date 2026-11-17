# PACKTOOK P66 — Local Firebase Emulator Integration

Status: CANDIDATE ONLY. No deployment, no production changes, no live
Staging calls. This PR does not close the P63 Callable Guard drift.

## Coverage

- Firebase Auth Emulator and Firestore Emulator, using the **demo-packtook-p66**
  project ID, local ports 9097 and 8097 and deny-all Firestore client rules.
- Firebase Admin SDK integration via an *isolated test adapter*, using real
  emulator user records and Firestore documents for the P65 Staging policy.
- Positive invitation path, revocation, expired lease, wrong App ID, disabled
  Auth account, revoked or mismatched live custom claims and conflicting
  production role token.
- Synthetic Firestore transactions covering duplicate reserve, finalize,
  and single-credit recovery under repeated calls.

**Important limitations:** The credit/reservation functions in this test are
synthetic and do not import or execute production/functions/index.js or its
real reserveCredit, finalizeCredit or recoverStaleVideoReservation functions.
The Emulator Suite does not prove Firebase App Check enforcement. Firestore
Admin SDK uses administrative privileges; the deny-all client rules file
must not be interpreted as rules-enforcement test coverage.
Cloud Functions Callable transport, ID-token verification, revoked ID tokens,
IAM, production environment initialization, real shared wallet semantics and
actual runtime App Check are NOT VERIFIED.

## Run in GitHub Actions (preferred)

The workflow installs Node 22, Java 21, Firebase Admin dependencies from
`production/functions/package-lock.json`, Firebase CLI 14.27.0, then
starts isolated Auth/Firestore emulators. No service account credentials,
Firebase login or any real Firebase Project ID is used.

Manual local run, on trusted workstation only:

```bash
npm ci --prefix production/functions --ignore-scripts --no-audit --no-fund
npm install --global firebase-tools@14.27.0 --ignore-scripts --no-audit --no-fund
export GCLOUD_PROJECT=demo-packtook-p66
export GCP_PROJECT=demo-packtook-p66
export GOOGLE_CLOUD_PROJECT=demo-packtook-p66
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9097
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8097
firebase emulators:exec --only auth,firestore --project demo-packtook-p66 --config production/staging-candidates/p66/firebase.json "node production/staging-candidates/p66/test-emulator-integration.cjs"
```

Do not run these commands inside an authenticated Cloud Shell with live
project credentials; GitHub Actions is preferred. Do not change the
demo-project guards. Do not merge or deploy this staging candidate.

## P66 release gates

P65 standalone denial tests + P66 emulator integration may pass, but
P63 Staging direct `onCall` drift remains, and backend App Check, real
credit/recovery handlers, and deployment authorization remain NOT_PROVEN.
`NO_GO_RELEASE`.
