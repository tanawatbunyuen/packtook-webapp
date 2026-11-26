# P231.146 — Hosted staging normal-client call-path and initialization audit

## Observed P231.145 operator evidence
`P231145_CALLPATH_EXIT_CODE=0`.
Both local and hosted bridges initialize App Check, use Enterprise provider, create Firebase Functions from the same app variable, and have `httpsCallable`.
- Local source calls `protectedApi("usageStatus")` and `protectedApi("recordingStatus")`, uses `appCheckReady` fail-closed guard, and exports `recaptchaEnterpriseSiteKey=""` in local config.
- Hosted source instead calls `api("usageStatus")` and `api("recordingStatus")`, does **not** contain `protectedApi` or `appCheckReady`, and embeds a registered-matching Enterprise site-key literal in its bridge (from P231.120). No secret site key printed.
- Neither bridge contains explicit `X-Firebase-AppCheck` header construction; Firebase client SDK is responsible for attaching it when initialized correctly.
- All three hosted assets differ from review-branch source files, as proved by P231.144.

## P231.146 read-only source-order check
`p231146-hosted-client-appcheck-init-order-readonly.py` fetches only hosted bridge JavaScript and reports structural boolean flags for:
- App, Functions, App Check, callable helper, and bridge export existence.
- Textual ordering of App Check initializer before callable helper, published bridge, and status methods.
- Same-app variable pattern for Functions/App Check.
- Auto-refresh, absent/present explicit protected wrapper, direct API status calls, and simple try wrapper.

This is **static lexical ordering**, not AST evaluation, control-flow verification, or proof that the actual normal PACKTOOK browser makes an App Check-authenticated business request. Do not upgrade Normal Client App Check runtime token-attachment gate to PASS based on this source inspection alone.

## Safety
Static HTTP GET only. No Cloud Function invocation, Firebase Auth tokens, App Check token requests, IAM changes, deployments or cleanup. Do not deploy the local empty-key config over hosted staging. Public signup remains closed, production NO_GO.

P231146_HOSTED_INIT_ORDER=AWAITING_OPERATOR_RESULT
P231146_NORMAL_CLIENT_RUNTIME_ATTACHMENT=NOT_VERIFIED
P231146_RELEASE=NO_GO
