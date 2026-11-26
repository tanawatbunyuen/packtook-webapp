# P231.33 — Browser client compatibility and source parity

Date: 2026-11-26
Branch: review/p231-appcheck-runtime-readiness
Scope: GitHub source inspection only; **not proof of currently served Firebase Hosting bytes**.

## Source observations

- `firebase.json` hosting.public points to `firebase-staging`.
- `firebase-staging/index.html` loads `firebase-packing-bridge.js?v=5.3.1`.
- `firebase-staging/firebase-packing-bridge.js` imports Firebase v11.10.0 Auth, Functions and App Check.
- App Check initialization uses `initializeAppCheck(app, {provider: new ReCaptchaEnterpriseProvider(recaptchaEnterpriseSiteKey.trim()), isTokenAutoRefreshEnabled: true})` only when site key is non-empty.
- `protectedApi(name)` requires nonempty site key and wraps `httpsCallable`.
- `usageStatus` and `recordingStatus` use `protectedApi`.
- `accountRole` calls `api("accountRole")` without the local protected wrapper. SDK-level automatic token attachment might still apply; **check actual header**.
- The checked-in `firebase-staging/firebase-v4-config.js` contains an empty public reCAPTCHA Enterprise site key. Yet operator reports the live staging browser sent `X-Firebase-AppCheck` for `usageStatus` with HTTP 200. This indicates **potential hosting/source parity drift**, but is not independently established because the precise Hosting release, served config bytes and browser cache have not been pinned.

## Safe next checks

1. Read-only browser: verify `accountRole` request method POST, resource URL contains `packtook-staging`, status and presence (not values) of Authorization and X-Firebase-AppCheck headers. Do not expose tokens, response bodies or account info.
2. `recordingStatus`: observe an existing legitimate request only; **do not fabricate operation IDs or trigger recordings/credit mutations**.
3. Pin currently-served site key as presence/absence, never copy full config into chat. Compare hashed bytes of Firebase Hosting `firebase-packing-bridge.js` and `firebase-v4-config.js` to the GitHub branch, accounting for query strings and actual Hosting domain.
4. Establish staging Hosting release ID, artifact provenance, and impact of restoring any historical source snapshot before deployment.
5. Isolated runtime test requires dedicated nonpublic function and synthetic data; needs separate scoped deployment approval. No production or live-staging updates authorized.

## Decisions
- `P231_CLIENT_APP_CHECK_USAGE_HEADER=OPERATOR_REPORTED_PRESENT`
- `P231_CLIENT_ACCOUNTROLE_HEADER=NOT_VERIFIED`
- `P231_CLIENT_RECORDINGSTATUS_HEADER=NOT_OBSERVED`
- `P231_HOSTING_SOURCE_PARITY=NOT_VERIFIED`
- `P231_RUNTIME_APPCHECK=NOT_VERIFIED`
- `P231_RELEASE=NO_GO`
- `PUBLIC_SIGNUP=KEEP_CLOSED`
