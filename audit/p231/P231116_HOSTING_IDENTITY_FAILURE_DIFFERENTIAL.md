# P231.116 — Hosted staging JS identity mismatch after P231.115

2026-11-26 operator result:
- P231_CHECK=STAGING_HOSTED_APPCHECK_CLIENT_READONLY
- P231_HOSTED_JS_IDENTITY=FAIL_OR_FALLBACK
- P231115_HOSTED_CLIENT_EXIT_CODE=2
- P231_RELEASE=NO_GO

P231.115 fetched the config, bridge, and index paths before applying an aggregate JS-identity gate. That aggregate gate failed and suppressed per-file distinctions. This does **not** establish which of the three files was unexpected, whether a SPA fallback was returned, whether client JS predates the repo, or whether the site key is configured.

P231.116 performs exactly three GETs under the same `https://packtook-staging.web.app` host with no redirected origins. It emits only HTTP status, content-type category, HTML classification, and Boolean code markers. The config site key is reported only EMPTY/NONEMPTY/NOT_PARSEABLE, never the value. Request bodies, full URLs, App IDs, API keys, secrets, email addresses, bearer tokens, cookies, and error responses are not printed or saved. No services are modified.

Expected possibilities:
- Config has HTML MIME / HTML markers: fallback, missing file, or unexpected hosting response; don't misclassify as blank key.
- Config script has Firebase export but lacks App Check symbol: deployed client revision differs from tracked source.
- Bridge lacks `initializeAppCheck`: deployed bridge differs from tracked source.
- All files recognizable but site key empty: real hosted client has a blank key.
- Other results: investigate service-specific hosting config safely without assuming the cause.

Even a nonempty hosted site key does not prove browser attestation or a valid token. The prior P231.94 E2E test approval was timeboxed to 2026-11-26 Asia/Bangkok; a new active E2E window requires explicit approval after expiry. No staging hosting change/deploy, IAM grant, production change or cleanup has been authorized.

P231_HOSTED_CLIENT_IDENTITY=UNRESOLVED
P231_BROWSER_ATTESTATION=NOT_PERFORMED
P231_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
