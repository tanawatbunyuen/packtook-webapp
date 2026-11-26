# P231.137 — Browser clipboard NotAllowedError at CLIPBOARD_WRITE

Reported output from the staging browser:
- P231_SCRIPT_VERSION=P231136_STAGE_DIAGNOSTIC_V3
- P231_FAILED_STAGE=CLIPBOARD_WRITE
- P231_ERROR_CLASS=NotAllowedError
- P231_GATE=BLOCKED_BROWSER_OR_CLIPBOARD_ERROR
- P231_CALLABLE_INVOKE=NOT_PERFORMED

Interpretation: Both tokens reached the clipboard stage, but Browser rejected automatic write. A plausible cause is missing transient user activation after awaited SDK requests. Exact permission/activation reason is not conclusively proven from the exception name alone.

P231.137 changed only the staging browser credential handoff helper (no hosted deploy) to create a visible transient page button. Script version P231137_USER_GESTURE_CLIPBOARD_V4. After two tokens are generated, script reports P231_BROWSER_COPY_BUTTON=READY_CLICK_WITHIN_60_SECONDS and displays a button in the upper-right of the *staging web page*. On direct user click, it invokes `navigator.clipboard.writeText(bundle)` without any preceding awaited operation. Reports P231_BUNDLE=COPIED_TO_LOCAL_CLIPBOARD_SENSITIVE after write success, and optional P231_CLIPBOARD_READBACK=VALID_JSON_MATCH. Does not place token values in DOM/Console, and removes button after copy or 60 seconds. A valid authorized 2026-11-26 Asia/Bangkok date and the exact staging origin are rechecked on click.

Process:
1. In trusted Cloud Shell, prepare runner and wait at its `Paste sensitive ... (hidden input):` prompt.
2. On the **browser** staging page, run the fresh handoff code in DevTools Console. Expect P231_SCRIPT_VERSION=P231137_USER_GESTURE_CLIPBOARD_V4, then P231_BROWSER_COPY_BUTTON=READY_CLICK_WITHIN_60_SECONDS.
3. Click the visible button in the upper-right of the staging page (not Console). Expect P231_BUNDLE=COPIED_TO_LOCAL_CLIPBOARD_SENSITIVE. If permission was still refused, report only P231_FAILED_STAGE / P231_ERROR_CLASS.
4. Switch back to Cloud Shell and paste once at the hidden input prompt. Do NOT copy anything else after clicking the button.
5. Clear clipboard after use; never paste credentials into chat, GitHub, normal shell prompt or logs.

This is a browser harness-only fix. Cloud Run IAM remains private. No real callable invocation from this browser helper. E2E is NOT_VERIFIED. Prior approved timebox only 2026-11-26 Bangkok. No prod/IAM/deploy/cleanup writes. Release NO_GO.

P231137_CLIPBOARD_USER_GESTURE=PATCH_COMMITTED_AWAITING_RESULT
P231137_RUNTIME_E2E=NOT_VERIFIED
P231_RELEASE=NO_GO
