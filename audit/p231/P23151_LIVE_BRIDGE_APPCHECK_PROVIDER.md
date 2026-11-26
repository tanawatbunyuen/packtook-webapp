# P231.51 — Live hosted App Check provider shape (operator-reported)

Date: 2026-11-26. Site: https://packtook-staging.web.app. Read-only browser inspection on fetched hosted `firebase-packing-bridge.js` (SHA256 `f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605`), with no Cloud Functions calls and no token/site-key value printed.

Operator output:
- `P231_CONFIG_IMPORT=FOUND`
- `P231_PROVIDER_CONSTRUCTOR=FOUND`
- `P231_PROVIDER_ARGUMENT_TYPE=STRING_LITERAL`
- `P231_SITE_KEY_IDENTIFIER_REFERENCE=NOT_FOUND`
- `P231_APPCHECK_INIT=FOUND`
- `P231_TOKEN_VALUES_EXPOSED=NO`
- `P231_BACKEND_CALLS=0`

Interpretation: the served bridge appears to pass a string literal directly into `new ReCaptchaEnterpriseProvider(...)`, rather than using a `recaptchaEnterpriseSiteKey` identifier. This **plausibly explains** why live `firebase-v4-config.js` exactly matches the GitHub root config (493 bytes) without a named site-key export, while the GitHub `firebase-staging/` variant uses a separate config variable. This classification relies on bounded regex rather than AST; it does not attest to literal validity, token verification, complete source provenance or deployed backend enforcement.

Follow-up, read-only: observe existing `accountRole` fetch request for `Authorization` and `X-Firebase-AppCheck` **header presence only**, response status, and verify target is packtook-staging; avoid token values, account PII, and response payload. Do not trigger recordingStatus or any mutation. Before isolated runtime deployment, separately approve scoped test function with synthetic data; do not replace live staging functions with restored source snapshots.

`P231_LIVE_BRIDGE_PROVIDER_SHAPE=STRING_LITERAL_OPERATOR_REPORTED`
`P231_HOSTED_BRIDGE_GIT_PROVENANCE=UNRESOLVED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_STAGING_DEPLOY=NOT_PERFORMED`
`P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
