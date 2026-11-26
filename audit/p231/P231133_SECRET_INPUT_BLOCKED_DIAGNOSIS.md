# P231.133 — Staging private callable E2E blocked at masked credential handoff

2026-11-26 operator P231.132 output:
- `P231_CHECK=ISOLATED_PRIVATE_CALLABLE_E2E_CONTROLLED`
- `P231_SERVICE_PREFLIGHT=PASS`
- `P231_REVISION_PIN=READY_REVISION_PRESENT`
- `P231_GOOGLE_IAM_ID_TOKEN=ACQUIRED_NOT_PRINTED`
- `P231_GATE=BLOCKED_SECRET_INPUT`
- `P231132_E2E_EXIT_CODE=2`
- `P231_RELEASE=NO_GO`

**Meaning**: Cloud Run IAM identity-token creation succeeded, but reading/validating the separate browser-provided Firebase Auth + App Check credential bundle failed. The script exited **before any Cloud Run invocation**. It did not prove a Firebase App Check or Cloud Run runtime rejection.

Root cause cannot be inferred from old generic exception handling. Possible input cases include an empty prompt, invalid JSON, absent expected fields, malformed tokens, or a terminal hidden-input issue. Do not copy actual clipboard contents into chat or the command line.

## Safe correction
Updated only `p231132-private-callable-e2e.py` credential-input block to print enumerated `P231_SECRET_INPUT_CLASS` values (EMPTY_INPUT, INVALID_JSON, missing token field, unexpected shape, no interactive TTY, prompt cancelled) without printing input, token, error response, or identities. The runner still checks the 2026-11-26 Asia/Bangkok approval window and private isolated service before attempting any active network requests. A successful input would continue to the isolated callable only under the original approved window. No IAM, Cloud Run or Firebase changes.

## Operator steps
1. While logged in on the owner-confirmed test account on `https://packtook-staging.web.app`, run the **P231.132 browser credential handoff JS** from a trusted Chrome/Edge DevTools Console. Verify `P231_BUNDLE=COPIED_TO_LOCAL_CLIPBOARD_SENSITIVE`. Never share the clipboard value or screenshots.
2. In the same trusted workstation's Cloud Shell Terminal, `git pull --ff-only origin review/p231-appcheck-runtime-readiness` and run `python3 -B audit/p231/isolated-test/p231132-private-callable-e2e.py`. Paste at the hidden prompt, not at the normal shell command prompt. The input is a JSON object, not two separate tokens.
3. Paste is sensitive and terminal UX may refuse it. If the tool outputs `P231_SECRET_INPUT_CLASS=...`, report only that classification, never actual pasted value.
4. After test, clear sensitive clipboard and do not export logs containing headers/body. If the approved test date elapsed, stop and get fresh approval before active calls.

Neither the `P231_SCRIPT_VERSION` for prior browser issuance, nor `P231_AUTH_USER_PRESENT=YES` alone establishes that the P231.132 browser handoff has been executed. Do not assume it happened.

P231_PRIVATE_IAM_TOKEN=ACQUIRED_OPERATOR_REPORTED
P231_E2E_CREDENTIAL_INPUT=BLOCKED
P231_CALLABLE_REQUESTS=ZERO_FROM_P231132
P231_APP_CHECK_RUNTIME_ENFORCEMENT=NOT_VERIFIED
P231_CLOUD_WRITES=0
P231_RELEASE=NO_GO
