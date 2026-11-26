# P231.140 — Partial App Check log trace correlation

Observed operator result (P231.139):
- P231_LOG_WINDOW=LAST_6_HOURS
- P231_LOG_ENTRY_COUNT=10
- P231_HTTP_200_COUNT=1
- P231_HTTP_401_COUNT=2
- P231_APPCHECK_DIAGNOSTIC_ENTRIES_WITH_TRACE=2
- P231_HTTP_401_TRACE_MATCHED_APPCHECK_DIAGNOSTIC=1
- P231_HTTP_200_TRACE_MATCHED_APPCHECK_DIAGNOSTIC=0
- P231_CORRELATION_RESULT=PARTIAL_TRACE_CORRELATION_INCONCLUSIVE
- P231139_LOG_CORRELATION_EXIT_CODE=0
- Zero cloud writes or function calls.

The P231.132 valid/missing/invalid active HTTP controls **passed 3/3 by observed behavior**, but log trace corroboration is currently 1/2, insufficient to classify both 401s as directly App Check-attributable. Never inflate log candidate count (2) into request-correlated count (2); never treat 401 alone as proof of root cause.

P231.140 provides a scoped, redacted, read-only trace coverage script for the same isolated service. It counts:
- HTTP 401 requests lacking trace
- HTTP 401 requests with trace but no matching App Check rejection diagnostic
- App Check diagnostic entries without trace
- App Check diagnostic traces not matching any 401
- HTTP 401 requests with trace matching a diagnostic.

No log text, trace IDs, principals, token values, URLs, or timestamps are output. A missing trace is **inconclusive**, not an enforcement failure. Logs may have different retention or diagnostic trace propagation. Log correlation alone still does not map all records to the named test cases without per-request linkage.

The read-only script does not call the isolated function. No more active tests are necessary until we decide whether strict root-cause attribution is essential, and any active tests after the 2026-11-26 Bangkok authorization window require fresh authorization. No production, public signup, IAM, deploy or cleanup changes.

P231140_RUNTIME_HTTP_BEHAVIOR=PASS_3_OF_3_OPERATOR_REPORTED
P231140_TRACE_CORRELATION=PARTIAL_ONE_OF_TWO
P231140_STRICT_ROOT_CAUSE_GATE=INCONCLUSIVE
P231140_RELEASE=NO_GO
