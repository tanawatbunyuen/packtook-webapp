# P112 — App Check client / backend staging readiness

**Decision: NO_GO_STAGING (source gate, until client App Check integration exists).**

## Verified source evidence
- `functions/index.js`: only `recordingStatus` and `usageStatus` now opt into the isolated `statusOptions` with `enforceAppCheck:true`.
- `firebase-staging/firebase-packing-bridge.js`: presently imports Firebase Auth/Functions but not `firebase-app-check.js`. It exposes callable requests for both protected endpoints.
- `firebase-staging/firebase-v4-config.js`: does not expose a staging reCAPTCHA Enterprise site key binding.
- `firebase-staging/index.html`: loads the bridge module.
- Note: GitHub source does not establish the live Cloud Functions revision. The static check is deliberately not a runtime PASS.

## Required remediation on separate review candidate
1. Obtain the **actual staging Firebase App Check Enterprise site key** through authorized Firebase configuration (public site key only; never put private API/service-account credentials in web code). Do not invent a key.
2. Initialize App Check on the same Firebase app instance with `ReCaptchaEnterpriseProvider(siteKey)`, and set `isTokenAutoRefreshEnabled:true`, before issuing protected callable requests. Fail closed if site key unavailable.
3. Ensure correct staging reCAPTCHA site domain allowlist, Cloud Functions App Check settings, and App Check service registration; separate staging and production site keys.
4. Run offline syntax/contract checks, then browser integration with staging accounts and test tokens, and capture callable logs. Use authorized App Check debug tokens only in isolated test contexts, never on production.
5. Negative tests: no Auth, unverified Auth, missing App Check, invalid App Check, other account's recording ID; positive test: valid verified Auth + valid App Check + owned resources.
6. Confirm exact deployed source revision, codebase, IAM, rollback, and monitoring; keep public signup closed. No deploy without environmental and authorization checks.

### Reproduce offline gate
```bash
node --check functions/index.js
node --check audit/p112-appcheck-client-readiness.cjs
node audit/p112-appcheck-client-readiness.cjs
```

Expected against current source: nonzero exit with `NO_GO_STAGING`; this is a *correct protective failure*, not a tested cloud exploit. Existing P111 script is a separate static backend check.

Reference: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider
