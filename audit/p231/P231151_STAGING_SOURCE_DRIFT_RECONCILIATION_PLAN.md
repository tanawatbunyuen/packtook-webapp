# P231.151 — Staging Source Drift Reconciliation and Predeploy Gate

## Source-backed findings
1. Repository `firebase.json` has `hosting.public = firebase-staging`. Therefore a Hosting deploy from this checkout uses **the reviewed files in `firebase-staging/`**, not necessarily the working hosted assets.
2. Repository `firebase-staging/firebase-v4-config.js` exports an **empty** `recaptchaEnterpriseSiteKey`, while repository `firebase-packing-bridge.js` requires a nonempty key before setting up Enterprise App Check and rejects protected `usageStatus` / `recordingStatus` if missing.
3. The hosted staging bridge instead initializes Enterprise App Check with a provider key literal that was previously checked to match the registered staging key, uses `api()` for status callables and has no matching `protectedApi` guard. This is **configuration/implementation drift**, not proof of a bypass.
4. P231.144 confirmed the hosted bridge, config and index all differ from GitHub source. P231.149/150 confirmed normal hosted `usageStatus` requests sent App Check/Auth headers and returned HTTP 200 (separate observations).

## Safe reconciliation decision (DESIGN ONLY)
- **Keep current hosted staging** unmodified. Do not blindly deploy `firebase-staging/` from the current checkout.
- Choose one canonical implementation for the site key, preferably **public staging site-key injection at an explicit Hosting build/publish step**, without committing administrator keys, signing credentials or reCAPTCHA secret keys. The Enterprise site key itself is public, but its *environment binding* must be reviewed so it never points staging to production.
- Make GitHub source and published assets converge by a reviewed PR that preserves `initializeAppCheck`, same-app `getFunctions`, Firebase SDK automatic header attachment, `usageStatus` / `recordingStatus` guarded fail-closed behavior, and exact staging domain/key allowlist.
- Before any deploy: (a) isolate a publish artifact; (b) verify generated bridge/config/index static behavior, key presence and staging domain **without printing key values**; (c) check behavior of missing-key fail-closed case; (d) obtain owner-specific deploy approval; (e) preserve rollback artifact and checksum; (f) deploy **Hosting-only** to staging, never the default all-targets deploy; (g) run controlled smoke tests and recheck no public signup / IAM drift.
- No Hosting deploy or source patch is authorized by this audit. Avoid treating a public site key as a private Firebase credential, but do not inadvertently share it in user logs.

## Automated fail-closed check
`audit/p231/isolated-test/p231151-staging-hosting-predeploy-drift-gate.py` reads the exact `firebase.json` Hosting public directory and the three local files, makes read-only GETs to the matching public hosted static assets, and prints only matching/drift and source-shape flags. It emits `P231_UNRECONCILED_DEPLOY_GATE=BLOCKED` and intentionally exits **3** if any drift remains or the repository key is empty. **Exit 3 is the expected safe gate**, not a script malfunction. It never reveals source JS, site key, Firebase IDs or credentials.

### Gate boundaries
Normal-client `usageStatus` HTTP and App Check header evidence is sufficient for observed staging frontend communication, but **not** proof that a blind redeploy is safe. P231 isolated E2E remains 3/3 HTTP PASS, static 9/9 PASS, strict log trace correlation 1/2 INCONCLUSIVE. No active function calls, IAM changes, deploys or cleanups; production NO_GO.

P231151_SOURCE_RECONCILIATION=PLAN_ONLY
P231151_HOSTING_DEPLOY=BLOCKED_PENDING_PARITY_AND_APPROVAL
P231151_RUNTIME_E2E=NO_NEW_CALLS
P231151_RELEASE=NO_GO
