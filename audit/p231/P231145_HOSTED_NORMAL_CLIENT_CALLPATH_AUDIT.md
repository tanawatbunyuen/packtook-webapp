# P231.145 — Hosted vs local normal-client App Check call path

## Observed user P231.144 static results
- All hosted bridge/config/index static GET HTTP 200.
- All three hosted files differ in bytes from their local review-branch files.
- Both local and hosted client bridge include App Check initialization, Enterprise provider, auto refresh and Firebase `httpsCallable` SDK.
- Local key export exists but literal value is empty; hosted key is hardcoded in bridge and not exported by config. Earlier P231.120 confirmed hosted hardcoded key matches registered Enterprise provider.
- Local `protectedApi("usageStatus")` and `protectedApi("recordingStatus")` patterns exist; those exact patterns are absent in hosted.
- Source shape difference is confirmed, not a proven missing App Check enforcement or runtime failure.

## New test
`audit/p231/isolated-test/p231145-hosted-normal-client-callpaths-readonly.py` makes only one static HTTPS GET to staging's `firebase-packing-bridge.js` and reads the matching local checkout source. It prints boolean flags distinguishing `protectedApi`, `api`, `httpsCallable`, names, bridge methods, and App Check initialization. It does not fetch tokens, sign into Firebase, call Cloud Functions or display source/site keys. Regular-expression matches are clues only; absence of a pattern does not prove absence of an equivalent runtime flow.

## Decision and safeguards
Do not deploy local GitHub config/bridge over hosted staging while they diverge: local key is empty and a blind deploy could block protected functions. Preserve existing revision, private IAM, public signup CLOSED, and Production NO_GO. Previously validated isolated function E2E (3/3 HTTP) does not prove standard PACKTOOK client automatically attaches App Check on business calls. This must be assessed separately using an authorized, non-mutating test or carefully reviewed runtime evidence.

No production/staging deploy, Cloud IAM writes, cleanup or callable invocations authorized or performed here.

P231145_STATIC_NORMAL_CLIENT_PATH=AWAITING_OPERATOR_RESULT
P231145_CLIENT_APPCHECK_ATTACHMENT=NOT_VERIFIED
P231145_RELEASE=NO_GO
