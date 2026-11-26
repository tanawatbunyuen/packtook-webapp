# P231.139 — Request/log correlation readiness, read-only

The operator ran P231.138 staging isolated log aggregate check:
- P231_LOG_WINDOW=LAST_3_HOURS
- P231_ISOLATED_LOG_ENTRY_COUNT=9
- P231_HTTP_200_COUNT=1
- P231_HTTP_401_COUNT=2
- P231_HTTP_403_COUNT=0
- P231_APPCHECK_REJECTION_DIAGNOSTIC_CANDIDATES=2
- P231_RESULT=LOG_AGGREGATES_ONLY_NOT_REQUEST_CORRELATED
- P231_APPCHECK_ENFORCEMENT_ROOT_CAUSE=REQUIRES_CORRELATED_DIAGNOSTICS
- P231138_LOG_CHECK_EXIT_CODE=0
- no credential values exposed, zero IAM writes/deploy/cleanup, release NO_GO

This supports the earlier 3/3 HTTP behavior test but cannot alone attribute each HTTP 401 to App Check.

New P231.139 script `p231139-isolated-log-correlation-readonly.py` reads only Cloud Run revision logs from isolated service `p231appcheckisolatedprobe` in `packtook-staging`. It counts HTTP 200/401 and App Check rejection diagnostic entries that share the **exact Cloud Logging trace** with a request. It does not print the trace ID, timestamps, URLs, messages, identities or credentials. No fallback from similar timestamp to correlation. A lack of shared traces is an INCONCLUSIVE result, not App Check failure.

Requirements:
- `TRACE_CORRELATION_SUPPORTS_APPCHECK_REJECTIONS` is support only if 2+ 401 requests have an App Check rejection diagnostic sharing trace and no 200 shares such diagnostic.
- Because P231.132 runner does not capture trace identifiers or per-case request times and P231.139 query includes a 6-hour window, even a successful correlation does **not independently link** log records to exactly P231.132's missing and malformed probes. Avoid stronger claims without more evidence.
- If no matching trace, avoid repeatedly recreating live invocations or changing log retention/IAM; use source-side verified `enforceAppCheck:true` and prior valid+missing+invalid HTTP cases as the evidence already available.
- No active requests are issued by this log inspection. Production NO_GO, public signup CLOSED; isolated resource cleanup needs separate authorization.

P231139_E2E_HTTP_BEHAVIOR=PASS_OPERATOR_REPORTED
P231139_AGGREGATE_LOGS=SUPPORTIVE
P231139_TRACE_CORRELATION=AWAITING_RESULT
P231139_RELEASE=NO_GO
