# P231.148 — Passive observer for normal staging App Check header attachment

## Objective
The P231.146 hosted normal-client code shape indicates App Check is initialized before bridge publication and uses the same Firebase app as `httpsCallable`, but it does not establish that a **normal frontend-generated** request includes `X-Firebase-AppCheck` in practice. This test isolates that remaining evidence gap without modifying the deployed application.

## Passive browser test
`audit/p231/isolated-test/p231148-normal-client-passive-header-observer.js` is pasted into the browser DevTools Console while logged in to the **owner-confirmed test-only staging account** on `https://packtook-staging.web.app`.

Properties:
- Fail closed on origin mismatch and any Bangkok date other than **2026-11-26**, the approved active-test window.
- Observe *only* POST fetch/XHR calls whose destination is precisely `https://asia-southeast1-packtook-staging.cloudfunctions.net/usageStatus` or `/recordingStatus`.
- Temporarily wrap window.fetch and XMLHttpRequest.prototype APIs, forwarding all arguments to the original implementations with original receiver. It **does not initiate** network requests, login or token issuance.
- If a matching normal application request happens during 90 seconds, print only endpoint name, transport, `APPCHECK_HEADER_PRESENT=YES/NO`, `FIREBASE_AUTH_HEADER_PRESENT=YES/NO`. Never print tokens, headers, URLs, payloads, usernames or responses.
- Restores the original functions on timeout, but a page refresh is recommended after test to remove temporary diagnostic wrappers. A request not seen within the window is **NOT VERIFIED**, not evidence of a missing token. Some SDK transports may capture `fetch` before the wrapper was installed; this can result in unobserved requests.

## Operator steps
1. Open staging web app and sign in using the designated **test-only** account; avoid any controls that reserve/finalize credits or create payments, operators, or devices.
2. Run the passive observer script in DevTools Console on 2026-11-26 Bangkok only.
3. While armed, use an existing **read-only status view** that makes the normal app fetch `usageStatus` (if known and available). The observer does not trigger calls on its own. Do not click actions that mutate business state.
4. Send back **only** `P231_` prefixed results. Do not expand browser DevTools network request headers or paste token values.
5. After 90 seconds or once evidence is collected, refresh the page. No source deploy, Cloud Function invocation from the script, IAM changes or cleanup.

## Evidence interpretation
- `P231_OBSERVED_CALL=usageStatus` and `P231_APPCHECK_HEADER_PRESENT=YES` with corresponding auth header indicates a normal client request *attempted* to send the App Check header. The observer does not validate token content or backend acceptance.
- `P231_APPCHECK_HEADER_PRESENT=NO` is a finding warranting careful verification; presence may be missed if SDK captured native fetch or used another transport. It is not alone proof of vulnerability.
- `P231_MATCHED_REQUEST_COUNT=0` means **NO MATCH**; do not infer header absence.
- Normal client source/hosted configuration drift remains unresolved. P231.132 isolated runtime E2E remains 3/3 observed HTTP behavior PASS. P231.142 isolated static tests remain 9/9 PASS. Strict App Check log trace correlation remains INCONCLUSIVE 1/2.

P231148_PASSIVE_OBSERVER=PREPARED_ONLY
P231148_NORMAL_CLIENT_RUNTIME_ATTACHMENT=NOT_VERIFIED
P231148_RELEASE=NO_GO
