# P231.144 — Normal PACKTOOK client App Check wiring inspection

## Source evidence already directly inspected
`firebase-staging/firebase-packing-bridge.js` checked in the review branch:
- Imports Firebase SDK 11.10.0 App Check and Callable modules.
- `initializeApp(firebaseConfig)` and `getFunctions(app,"asia-southeast1")`.
- `appCheckReady` requires nonempty `recaptchaEnterpriseSiteKey` imported from `firebase-v4-config.js`.
- `initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(...),isTokenAutoRefreshEnabled:true})` runs if key is present.
- `usage()` and `recordingStatus()` call `protectedApi(...)`, which throws when the key is empty.
- Other operations use plain `api`, which calls `httpsCallable` on the same Firebase app instance; Firebase SDK App Check automatic token attachment relies on successful app-level initialization and actual runtime behavior.

`firebase-staging/firebase-v4-config.js` **repository source** exports `recaptchaEnterpriseSiteKey=""` — fail-closed for the two protected endpoints. Earlier P231.116-P231.121 evidence found the **deployed hosted staging client** differs: hosted config did not export that site-key symbol and hosted bridge constructed the Enterprise provider with a matching nonempty literal site key. These are **different build shapes**, not an automatic conclusion that the live client is misconfigured. The live deployed bridge and index relationship needs verification.

## Read-only staging static comparison
`p231144-normal-client-apcheck-static-readonly.py` reads local checked-out staging bridge, config, and index; HTTP GETs the corresponding public **static files** from `https://packtook-staging.web.app`. It prints only status, source-equality and source-shape flags. It never prints JS, key strings, app identifiers, Cloud metadata, request headers, or secrets. It performs **no callable/backend request**. Local source and deployed hosted JavaScript are distinguished explicitly.

Limitations: simple regular expressions are structural clues, not a transpiled JavaScript parser or execution proof. A successful static check **cannot confirm automatic X-Firebase-AppCheck attachment** on live application requests. Functional assertion must be separately authorized and observed in a controlled non-mutating endpoint, without showing token headers.

## Security boundaries
- No IAM changes, deploy, public signup, cleanup, or production writes.
- Read-only static GET may run after the active 2026-11-26 Bangkok approval window, because no tokens are requested and no functions invoked.
- Production release NO_GO; previous P231.142 source fixtures 9/9 and P231.132 isolated HTTP E2E 3/3 remain unchanged.
- Strict per-request diagnostic correlation remains 1/2 INCONCLUSIVE.

P231144_NORMAL_CLIENT_STATIC_COMPARISON=AWAITING_RESULT
P231144_LIVE_CLIENT_TOKEN_ATTACHMENT=NOT_VERIFIED
P231144_RELEASE=NO_GO
