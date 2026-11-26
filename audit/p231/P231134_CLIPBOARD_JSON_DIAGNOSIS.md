# P231.134 — Credential handoff JSON rejected before isolated callable invocation

Operator's last result:
- P231_GOOGLE_IAM_ID_TOKEN=ACQUIRED_NOT_PRINTED
- P231_SECRET_INPUT_CLASS=INVALID_JSON
- P231_GATE=BLOCKED_SECRET_INPUT
- P231133_E2E_EXIT_CODE=2
- P231_RELEASE=NO_GO

This means JSON was invalid at the hidden Cloud Shell prompt. The prior browser token issuance and IAM readiness still stand, but runtime function was **never invoked by this attempt**. No inference about backend App Check enforcement can be drawn.

Changes committed:
- `p231132-browser-credential-handoff.js` now identifies itself as `P231134_CLIPBOARD_READBACK_V2`. After writing JSON credentials to local clipboard, it tries `navigator.clipboard.readText()`, structurally compares both fields **without printing token values**, then reports `P231_CLIPBOARD_READBACK=VALID_JSON_MATCH`, `MISMATCH_DO_NOT_PASTE`, or `NOT_VERIFIED_BROWSER_PERMISSION`.
- `p231132-private-callable-e2e.py` now differentiates `P231_SECRET_INPUT_CLASS=BRACKETED_PASTE_CONTROL_SEQUENCE`, `CONSOLE_STATUS_NOT_JSON`, `JSON_CORRUPTED_DURING_PASTE`, `CLIPBOARD_NOT_JSON_BUNDLE` without printing submitted data.

Safe execution order: prepare Cloud Shell command FIRST, and have its masked prompt open, THEN run the latest browser handoff using the verified staging test account and immediately paste the credential bundle into the masked prompt. Copying other text or code *after* the browser handoff overwrites the clipboard and leads to INVALID_JSON. Use a trusted private workstation, not a public browser/shared clipboard. Do not paste credential bundle into chat, commands, files or logs; clear clipboard after test.

No attempt is authorized outside 2026-11-26 Bangkok without fresh explicit approval. The runner retains the time gate. No production/IAM/cleanup writes and runtime App Check E2E remains NOT_VERIFIED.

P231134_BROWSER_CLIPBOARD_CHECK=AWAITING_RESULT
P231134_PRIVATE_RUNNER=AWAITING_RESULT
P231134_RUNTIME_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
