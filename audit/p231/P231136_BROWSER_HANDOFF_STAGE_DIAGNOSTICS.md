# P231.136 — Browser credential handoff blocked; stage-classified diagnostic patch

User browser result: P231_CHECK=CONTROLLED_E2E_STAGING_BROWSER_CREDENTIAL_HANDOFF; P231_SCRIPT_VERSION=P231134_CLIPBOARD_READBACK_V2; P231_GATE=BLOCKED_BROWSER_OR_CLIPBOARD_ERROR; P231_CALLABLE_INVOKE=NOT_PERFORMED; P231_RELEASE=NO_GO.

Do not interpret this as a clipboard permission failure without further evidence. The earlier top-level catch masked SDK import, Firebase auth, bridge fetch, token issuance, and Clipboard write errors. No browser bundle was confirmed copied, and no function invocation was made.

The browser helper now reports version `P231136_STAGE_DIAGNOSTIC_V3` and, upon an exception, `P231_FAILED_STAGE` from a bounded set of markers and `P231_ERROR_CLASS` (strict allowlist of browser exception *names*, no messages, URLs, credential values or stack traces). It still requires the exact staging origin, date 2026-11-26 in Asia/Bangkok, no debug token, verified test login and genuine App Check issuance. It doesn't call Cloud Run or modify IAM. It copies sensitive credentials to the clipboard only if all earlier gates pass.

Interpretation:
- LOAD_SDK_AND_CONFIG: SDK import or config issue
- FIREBASE_AUTH_STATE: existing Firebase auth instance or state
- READ_HOSTED_BRIDGE: bridge fetch/regex stage
- INITIALIZE_TEMP_APPCHECK: App Check setup
- ISSUE_AUTH_AND_APPCHECK_TOKENS: Auth/App Check token request
- CLIPBOARD_WRITE: browser Clipboard write failure (permission or user activation possible)
- CLIPBOARD_READBACK: readback is noncritical and its own catch reports NOT_VERIFIED_BROWSER_PERMISSION

Never paste credential bundle into shell as code, chat, GitHub, screenshots or logs. Browser DevTools may prohibit clipboard after an await because it no longer has user gesture. Do not reduce origin/date/security checks or use debug App Check tokens to work around it.

The only previously approved active staging test date was 2026-11-26 Bangkok. For later dates, renew authorization before active token requests or callable tests. Production NO_GO, public signup CLOSED. Current E2E remains NOT_VERIFIED.

P231136_BROWSER_DIAGNOSTIC=COMMITTED_AWAITING_RESULT
P231136_RUNTIME_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
