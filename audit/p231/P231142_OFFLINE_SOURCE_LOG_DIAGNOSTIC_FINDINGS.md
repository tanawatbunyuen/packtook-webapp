# P231.142 — Offline source and log-diagnostic evidence analysis

Source reviewed directly from `audit/p231/isolated-test/index.js` on branch `review/p231-appcheck-runtime-readiness`. The callable declaration has:
- `invoker:'private'`, `enforceAppCheck:true`
- dedicated staging-only service account
- defensive handler checks for `request.app?.appId`, verified Firebase Auth, and empty payload
- a constant PASS result when accepted.

**Evidence boundary:** This function source has **no explicit logging** for early App Check validation rejection. The Firebase Functions callable wrapper can reject a request before the user-defined handler executes. Any rejection diagnostic is therefore framework/platform generated rather than guaranteed by code inside this handler. Inspecting only handler source does not reveal exact versions, wrapper branches or logging behavior of the **deployed** `firebase-functions` package; `package.json` specifies `^6.0.0`, a range, not an immutable runtime pin.

## P231.140 outcome and nuance
- 1 HTTP 200, 2 HTTP 401
- All HTTP 401 have Cloud Logging traces
- 2 App Check rejection diagnostic entries also have traces
- 1 HTTP 401 shares a trace with at least one App Check diagnostic; the other does not
- Both diagnostics are counted as sharing some HTTP 401 trace (`APPCHECK_DIAGNOSTIC_TRACE_NOT_MATCHING_401=0`)

Under the P231.140 classification logic, this pattern is consistent with **two diagnostic entries sharing one HTTP 401 trace**, but without a separate distinct-trace count this is an inference from aggregate output, not a separately inspected log binding. It is *not* correct to call both individual rejected test cases diagnosed.

**Security disposition:** operator-observed HTTP E2E valid/missing/invalid 3/3 behaves as designed and App Check is configured to enforce. Strict per-request diagnostic attribution is still **INCONCLUSIVE** and cannot be cured by source inspection alone. The missing diagnostic could be absent or worded differently, or a different rejection path occurred. No evidence justifies weakening IAM or App Check.

## Offline fixture
Run from checkout root:
`node audit/p231/isolated-test/p231142-source-diagnostic-coverage-offline.cjs`
It verifies 9 static safety properties and absence of explicit handler logging; **only** local file I/O, no Cloud Run calls, network, credential access or writes.

## Recommended future instrumentation (requires separate authorization)
If strict root-cause accountability is a release gate, propose a **separate** controlled isolated-staging revision that emits a privacy-preserving trace correlation marker at an appropriate middleware boundary and a non-sensitive request case identifier. Before implementation, inspect the actual deployed `firebase-functions` package version and wrapper logging behavior, because early App Check rejection can occur before application handler logging. Add no authorization changes, no production deployment or customer-data logging. Correlate requests via platform tracing without storing tokens. The existing staging approvals for active tests are date-limited to 2026-11-26 Asia/Bangkok.

## No active changes
No new App Check token requests, callable invocations, IAM writes, deploy, cleanup, production changes, or public signup.
`P231142_SOURCE_AUDIT=OFFLINE_READY`
`P231142_HTTP_BEHAVIOR=PASS_3_OF_3_OPERATOR_REPORTED`
`P231142_ROOT_CAUSE_CORRELATION=INCONCLUSIVE`
`P231142_RELEASE=NO_GO`
