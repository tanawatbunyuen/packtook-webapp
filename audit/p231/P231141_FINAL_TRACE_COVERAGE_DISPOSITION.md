# P231.141 — Final disposition of current isolated App Check trace evidence

## Operator-reported P231.140 observation
- `P231_CHECK=ISOLATED_APPCHECK_TRACE_COVERAGE_READONLY`
- `P231_HTTP_200_COUNT=1`
- `P231_HTTP_401_COUNT=2`
- `P231_HTTP_401_WITHOUT_TRACE=0`
- `P231_HTTP_401_WITH_TRACE_NO_APPCHECK_DIAGNOSTIC=1`
- `P231_HTTP_401_WITH_TRACE_MATCHED_DIAGNOSTIC=1`
- `P231_APPCHECK_DIAGNOSTIC_TOTAL=2`
- `P231_APPCHECK_DIAGNOSTIC_WITHOUT_TRACE=0`
- `P231_APPCHECK_DIAGNOSTIC_TRACE_NOT_MATCHING_401=0`
- `P231_CORRELATION=PARTIAL_OR_UNAVAILABLE`
- `P231_ROOT_CAUSE=INCONCLUSIVE_UNLESS_INDEPENDENT_REQUEST_CORRELATION`
- `P231140_TRACE_COVERAGE_EXIT_CODE=0`
- Cloud writes 0; runtime calls 0; release NO_GO.

## Interpretation
Every observed HTTP 401 request possesses a trace, but only **one of the two 401 requests** shares a trace with a classifier-detected App Check rejection diagnostic. Two diagnostic entries are present and have traces, but this is **not evidence of two independently matched rejected requests**. The aggregate counts and code do not identify which of the Missing vs Invalid App Check cases corresponds to the matched trace, nor whether the unmatched HTTP 401 lacks such a diagnostic altogether, logs a differently worded diagnostic, or experienced a separate rejection path.

## Verified scope (operator-supplied earlier gates)
- Isolated Gen2 staging function ACTIVE, expected dedicated runtime service account and ready revision.
- Cloud Run private Invoker direct policy: zero public, one active operator; P231.105 historical anonymous request 403.
- Staging browser issued nonempty real App Check token; verified-email staging user was explicitly identified by owner as a test account.
- P231.132 same isolated service, operator-supplied valid case returned HTTP 200 with expected `PASS`; Missing App Check returned 401; malformed App Check returned 401; no token values printed.
- P231.138 Cloud Run log aggregates observed 1 HTTP 200 and 2 HTTP 401 in a 3-hour window, plus 2 App Check rejection diagnostic candidate entries.
- P231.139 and P231.140 trace correlation corroborated one 401, not both.

## Decision
`P231_HTTP_BEHAVIOR_GATE=PASS_3_OF_3`
`P231_CLOUD_RUN_PRIVATE_IAM_GATE=PASS_DIRECT_POLICY`
`P231_APPCHECK_DIAGNOSTIC_CORRELATION=PARTIAL_1_OF_2`
`P231_STRICT_PER_REQUEST_ROOT_CAUSE_GATE=INCONCLUSIVE`
`P231_ISOLATED_SECURITY_AUDIT_DISPOSITION=PARTIAL_PASS_WITH_OPEN_EVIDENCE_GAP`
`P231_RELEASE=NO_GO`

This is not evidence that App Check enforcement is broken. It is also not sufficient to mark root-cause evidence complete. Avoid further repetitive log-count scripts without new evidence. If strict per-request attribution is mandatory, next work should first review the isolated callable's own logging structure and Firebase wrapper behavior *offline* to identify a defensible non-sensitive correlation strategy; do not redeploy or invoke on production. Any additional active staging tests after the authorized 2026-11-26 Bangkok window require fresh explicit approval. Do not disable IAM authentication or App Check, grant new roles, enable public signup, delete isolated resources, or deploy production without separate authorization.

P231_CLOUD_WRITES=0
P231_RUNTIME_CALLS=0
P231_RELEASE=NO_GO
