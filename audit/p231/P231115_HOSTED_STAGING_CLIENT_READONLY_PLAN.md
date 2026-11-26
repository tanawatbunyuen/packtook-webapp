# P231.115 — Public staging Hosting App Check client verification (READ ONLY)

2026-11-26. P231.113 operator inventory found App Check initialization and Enterprise provider references in `firebase-staging/firebase-packing-bridge.js`. Exact GitHub source inspection found:
- `firebase-staging/firebase-v4-config.js` has `projectId: "packtook-staging"` and `recaptchaEnterpriseSiteKey = ""`.
- `firebase-staging/firebase-packing-bridge.js` only initializes App Check if the client site key is nonempty.
- `firebase-staging/index.html` references `firebase-packing-bridge.js`.
- Root `firebase.json` sets hosting public directory to `firebase-staging`.

Server config read-only GET previously confirmed Enterprise site key present. That does **not** prove the hosted browser app is configured or passes attestation.

## New P231.115 static deployed-client inspection

A read-only operator-side script GETs ONLY three paths under `https://packtook-staging.web.app`:
`/firebase-v4-config.js`, `/firebase-packing-bridge.js`, and `/`.
It checks response identity and `projectId`, classifies the hosted `recaptchaEnterpriseSiteKey` as EMPTY/NONEMPTY/DYNAMIC_OR_UNPARSEABLE, detects App Check code and a script reference in the index. It refuses redirects, limits response size, never prints a site key, Firebase App ID, API key, domain secrets, raw body or bearer token.

The default staging Hosting domain is a target convention, not proof of the current canonical app URL. Unexpected access/redirect/404 should block and require a verified alternate staging URL (not force a production URL). This test does not guarantee the exact frontend deployed revision, active browser execution, App Check attestation or validity of Auth users. No source modification or hosting redeploy is authorized.

If hosted site key is EMPTY, a future owner-approved isolated staging-only client configuration change is required before genuine browser attestation. Never substitute a debug token or production key. Existing staging Functions, Production, Public Signup and IAM remain untouched. Cleanup of the new probe still requires separate approval.

P231_HOSTED_CLIENT_CONFIG=AWAITING_READ_ONLY_RESULT
P231_VALID_APPCHECK_TOKEN=NOT_MINTED
P231_BROWSER_ATTESTATION=NOT_PERFORMED
P231_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
