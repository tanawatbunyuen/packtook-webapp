# P231.126 — Browser output reflects stale App Check test harness

2026-11-26 user supplied:
- P231_TOKEN_RESPONSE=UNEXPECTED_RESPONSE
- P231_REAL_BROWSER_ATTESTATION=NOT_VERIFIED
- P231_APP_CHECK_TOKEN_VALUE=NOT_PRINTED
- P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED
- P231_CLOUD_RUN_FUNCTION_INVOKE=NOT_PERFORMED
- P231_RUNTIME_APPCHECK_E2E=NOT_PERFORMED
- P231_IAM_WRITES=0; P231_DEPLOY=NOT_PERFORMED; P231_CLEANUP=NOT_PERFORMED; P231_RELEASE=NO_GO.

GitHub source check on review/p231-appcheck-runtime-readiness:
- Corrected `audit/p231/isolated-test/p231123-browser-appcheck-attestation-console.js` does **not** contain `UNEXPECTED_RESPONSE`.
- Corrected script reports `ISSUED_NONEMPTY` or `NO_NONEMPTY_TOKEN` for `P231_TOKEN_RESPONSE`. This source was tested with P231.125 5/5 fixture PASS.
- Therefore the observed `UNEXPECTED_RESPONSE` could not originate from the corrected source **as checked**; strongest explanation is older Console code, stale tab history or copied earlier script (not definitive proof which execution the lines belong to).
- Added `P231_SCRIPT_VERSION=P231126_TOKEN_ONLY_VALIDATOR_V2` to source so an operator can positively identify the current script in Console before interpreting results.

No runtime App Check success/failure can be determined from this stale/historical label. Recopy a fresh version of the source directly from GitHub rather than replaying a past Console snippet. Do not share Token values or paste production credentials. The original browser test approval was date-limited to 2026-11-26 Bangkok time; the script retains its fail-closed time guard. After that date, obtain new explicit approval before attempting active attestation.

No IAM/cloud/deploy/cleanup changes, Production NO_GO.

P231_BROWSER_TEST_HARNESS=CORRECTED_WITH_VERSION_MARKER
P231_OLD_RESULT=STALE_SCRIPT_INDICATED
P231_VALID_APPCHECK_TOKEN=NOT_VERIFIED
P231_RUNTIME_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
