# P231.138 — Isolated runtime App Check HTTP behavior PASS, logs not yet corroborated

Operator output from active **staging-only** P231.132 runner:
- P231_SERVICE_PREFLIGHT=PASS
- P231_REVISION_PIN=READY_REVISION_PRESENT
- P231_GOOGLE_IAM_ID_TOKEN=ACQUIRED_NOT_PRINTED
- P231_SECRET_INPUT_CLASS=VALIDATED_IN_MEMORY
- P231_FIREBASE_AUTH_AND_APPCHECK=PRESENT_NOT_PRINTED
- P231_VALID_HTTP_STATUS=200
- P231_VALID_RESULT=PASS
- P231_VALID_CONTROL_GATE=PASS
- P231_MISSING_APPCHECK_HTTP_STATUS=401
- P231_MISSING_APPCHECK_REJECTED=YES
- P231_INVALID_APPCHECK_HTTP_STATUS=401
- P231_INVALID_APPCHECK_REJECTED=YES
- P231_E2E=HTTP_BEHAVIOR_PASS_NEEDS_LOG_CORROBORATION
- No token values printed, IAM writes 0, deploy/cleanup not performed, release NO_GO.

**Classification:** 3/3 observed HTTP case outcomes match design. With the same IAM/Auth credentials and same isolated Cloud Run service, valid App Check was accepted and missing or malformed App Check rejected. This is strong end-to-end behavior evidence, not yet a proven root-cause trace for both HTTP 401 responses. Cloud Run HTTP 401 is not itself enough to attribute the rejection to App Check alone.

Next: use `p231138-isolated-log-aggregates-readonly.py` in Cloud Shell to collect *only* counts from 3h Cloud Logging logs scoped to the exact isolated Cloud Run service (cloud_run_revision); no sensitive content output. The script reports HTTP response frequencies and candidate App Check log messages. These aggregate counts are supportive evidence only, and logs can include unrelated requests. If no App Check diagnostics appear, do not claim root-cause verified; a targeted correlation with sanitized timestamps/revision/trace, without payloads or identity, is still required.

No further live callable invocation is required for this step. After 2026-11-26 in Asia/Bangkok, further active calls need renewed explicit authorization. Read-only log inspection can continue. Do not grant new IAM, deploy to production or staging, reopen public signup or delete isolated function.

P231138_ISOLATED_HTTP_VALID=PASS_OPERATOR_REPORTED
P231138_ISOLATED_HTTP_MISSING_APPCHECK=REJECTED_401
P231138_ISOLATED_HTTP_INVALID_APPCHECK=REJECTED_401
P231138_LOG_CORROBORATION=AWAITING_RESULT
P231138_RELEASE=NO_GO
