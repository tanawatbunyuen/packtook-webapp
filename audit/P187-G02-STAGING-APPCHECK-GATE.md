# P187 — G02 Staging App Check Verification Gate

**NO_GO_G02 / NO_GO_RELEASE / NO_GO_DEPLOY / PUBLIC_SIGNUP_CLOSED.**

## New evidence path
P187 adds a restricted two-request HTTP read-only verifier for the staging `usageStatus` Callable endpoint. It requires **real** staging Firebase Auth and App Check tokens obtained by an authorized operator; the test never mints tokens, bypasses enforcement or prints credentials, user IDs, URLs or HTTP response bodies. One call omits App Check (must deny 401/403); one supplies the independently issued App Check token (must succeed 200). A result `passed=true` is only a scoped operator-collected staging evidence claim, **not** G02 signoff or proof of token signature in production.

Only the exact HTTPS origin `asia-southeast1-packtook-staging.cloudfunctions.net` and `/usageStatus` path are allowed; all other projects and arbitrary `*.run.app` hosts are **denied** to avoid credential exfiltration. If the true staging callable URL is different (for example a Gen2 Cloud Run URL), a separate security-reviewed **exact-host pin** is required before any real token can be supplied. The operator must confirm the allowed endpoint maps to the actual staging revision. This source file is safe to execute offline in CI with mocked fetch; the real CLI denies CI and only targets `packtook-staging`.

## Human-invoked staging test (NOT executed in CI)
With independently approved change ticket and real valid tokens from trusted Staging application flow:
```bash
export PACKTOOK_G02_TARGET_PROJECT=packtook-staging
export PACKTOOK_G02_OPERATOR_APPROVED_PROJECT=packtook-staging
export PACKTOOK_G02_OPERATOR_CHANGE_TICKET=G02-STAGING-APP-CHECK-20261124
export PACKTOOK_G02_APP_CHECK_READ_ONLY_ACK=I_AUTHORIZE_STAGING_READ_ONLY_PROBE
export PACKTOOK_G02_STAGING_USAGE_STATUS_URL="https://<VERIFIED-STAGING-CALLABLE-HOST>/usageStatus"
# Set PACKTOOK_G02_STAGING_AUTH_ID_TOKEN and PACKTOOK_G02_STAGING_APP_CHECK_TOKEN
# using an approved secure operator environment; do not print, commit or paste them.
node audit/p187-staging-appcheck-cli.js
```
Replace the placeholder with a confirmed operator-verified staging callable endpoint. This probe uses two authenticated read requests and must never run on live production.

## Cannot clear G02 yet
- P186 live operator read-only inventory has not run, independent owner provenance is not established; no legacy migration approved.
- P184 Auth/Functions/Firestore local emulator passed 14/14 but positive valid App Check path **has not** been verified.
- A security reviewer still needs to approve source with P183 ownerUid authorization guard and P184 FieldValue import, plus full regression and exact deployed/staged revision provenance.
- G03/04 token-signature and invalid bearer transport verification remain separate blockers.

CI fixtures intentionally use fake strings with mocked fetch and do not attest real token acceptance.
