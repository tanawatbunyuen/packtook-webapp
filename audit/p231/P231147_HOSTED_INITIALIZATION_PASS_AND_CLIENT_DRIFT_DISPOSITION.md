# P231.147 — Hosted normal-client App Check lexical initialization audit PASS

## Operator-reported P231.146 evidence
- `P231_APP_INITIALIZER_PRESENT=YES`
- `P231_FUNCTIONS_INITIALIZER_PRESENT=YES`
- `P231_APPCHECK_INITIALIZER_PRESENT=YES`
- `P231_ENTERPRISE_PROVIDER_PRESENT=YES`
- `P231_CALLABLE_HELPER_PRESENT=YES`
- `P231_BRIDGE_EXPORTED_PRESENT=YES`
- `P231_USAGE_METHOD_PRESENT=YES`
- `P231_RECORDING_METHOD_PRESENT=YES`
- `P231_INIT_APPCHECK_BEFORE_BRIDGE_EXPORT=YES`
- `P231_INIT_APPCHECK_BEFORE_CALLABLE_HELPER=YES`
- `P231_INIT_APPCHECK_BEFORE_STATUS_METHODS=YES`
- `P231_SAME_APP_PATTERN=YES`
- `P231_AUTO_REFRESH_ENABLED=YES`
- `P231_PROTECTED_API_GUARD_PRESENT=NO`
- `P231_STATUS_DIRECT_API_USAGE=YES`
- `P231_INITIALIZE_WRAPPED_IN_TRY=NO`
- `P231_ANALYSIS_SCOPE=TEXTUAL_ORDER_ONLY_NOT_EXECUTION_PROOF`
- `P231_AUTOMATIC_TOKEN_ATTACHMENT=NOT_VERIFIED`
- `P231_BACKEND_CALLS=0`; `P231_CREDENTIALS=NONE`; `P231_CLOUD_WRITES=0`
- `P231146_INIT_ORDER_EXIT_CODE=0`; `P231_RELEASE=NO_GO`

## Evidence-backed interpretation
The hosted bridge contains the required Firebase App Check initialization, Enterprise provider, automatic refresh, and status method call path; lexical ordering precedes the published bridge/callable helper. These are useful **source-shape checks**, not actual execution or token-attachment proof. The absence of a `protectedApi` wrapper is not by itself a bypass: with a successfully initialized App Check instance, the Firebase Functions SDK can attach tokens for calls using that app. However, hosted bridge's lack of an explicit `appCheckReady` fail-closed guard should not be described as equivalent to repository staging source safeguards without observing real behavior.

## Confirmed source drift
P231.144 verified local-vs-hosted inequality for bridge, config and index. Repository `firebase-staging/firebase-v4-config.js` exports empty `recaptchaEnterpriseSiteKey`; hosted config does not export that symbol. Hosted bridge uses an embedded public Enterprise site key (previous matching-key check P231.120). Local bridge imports the site key from config; hosted bridge uses direct provider construction. Local protected status calls use `protectedApi`, hosted uses `api`. Blind redeployment is risky and prohibited pending reconciliation.

## Decision and next gates
1. Mark `HOSTED_STATIC_APPCHECK_INITIALIZATION=PASS_LEXICAL_ONLY`.
2. Mark `NORMAL_CLIENT_LIVE_APPCHECK_HEADER_ATTACHMENT=NOT_VERIFIED`.
3. Mark `SOURCE_HOSTED_CONFIGURATION_PARITY=FAIL_DRIFT_CONFIRMED` as a parity finding, **not** a confirmed App Check exploit.
4. Reconcile the desired canonical staging source: use a controlled environment-specific *public* Enterprise site-key provisioning process while keeping secrets out of repo; preserve the registered staging key and fail-closed behavior; make the hosted and version-controlled implementation converge. This is a design recommendation, **not** a source patch or deploy authorization. Avoid hardcoding the staging key into a tracked source file without deliberate configuration review.
5. For runtime verification, separately authorize a non-mutating normal-client callable read on the owner-confirmed staging test user, and inspect whether the Firebase SDK supplied the `X-Firebase-AppCheck` header using a **yes/no-only** tool in a trusted browser; do not print/copy its value. This must not be conflated with the temporary isolated-App token issuance test or private isolated function E2E.
6. Preserve isolated function root-cause trace correlation as `INCONCLUSIVE_1_OF_2`; do not retest solely to force log counts.
7. All active tests remain subject to the 2026-11-26 Asia/Bangkok authorization window; after expiration new active approval is required. Static/offline checks may continue.

## Cumulative status
- Isolated staging HTTP E2E valid/missing/invalid: 3/3 behavior PASS (operator-observed)
- Isolated static security assertions: 9/9 PASS (operator-observed)
- Private Invoker direct policy: PASS (operator-observed)
- Normal hosted initialization order: PASS (lexical only)
- Normal client App Check header attachment: NOT_VERIFIED
- Normal staging source/hosted parity: DRIFT CONFIRMED
- Isolated strict diagnostic trace correlation: INCONCLUSIVE 1/2
- Production: NO_GO

No IAM writes, deployments, cleanups, business function invocations, or public signup changes were performed by P231.147.
