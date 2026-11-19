# P113 — Executed source regression evidence (2026-11-19)

## Execution result
**7 / 7 PASS** in isolated V8 using the exact JavaScript fetched from the GitHub review branch and mocked Firebase SDK components. This is **real source execution**, but it is **not** a real Firebase staging runtime test, App Check token validation, Cloud Functions deployment or a GitHub Actions green check.

Fetched source blob SHA:
- `firebase-staging/firebase-packing-bridge.js`: `2fe8976da6a12a19cc7c04f48e3fbd8d653c3a33`
- `functions/index.js`: `92262ea2fbbb941188937d72f0eea74a735d2bf3`

## Mocked execution checks — all PASS
1. Backend retains status-only App Check enforcement configuration.
2. Without site key, client never initializes App Check.
3. Without site key, `usageStatus` client wrapper rejects.
4. Without site key, `recordingStatus` client wrapper rejects.
5. Without site key, unrelated `deviceStatus` callable remains reachable in the mock.
6. With fake local test site key, App Check initialization precedes callable use.
7. With fake local test site key, both status wrappers call the mock callable SDK.

## Critical limitations
- A fake `test-public-site-key` was used **only in-memory** with a mocked SDK. No fake key was written into staging configuration and no real App Check token was issued.
- `firebase-staging/firebase-v4-config.js` intentionally exports an **empty** `recaptchaEnterpriseSiteKey`. Thus **NO_GO_STAGING** remains the appropriate decision.
- GitHub Actions workflow created, but no completed CI run has been established. A test script being present is not evidence that Node CI executed.
- No Firebase calls, live credentials, IAM change, rollout, merge or production write occurred.

## Follow-up to get an actual staging runtime PASS
1. Provide/provision valid staging reCAPTCHA Enterprise public site key and verify domain registration, correct Firebase App Check app linkage.
2. Validate `node --check`, P111/P112/P113 Node scripts via CI logs.
3. Verify exact Functions source provenance and target codebase/selector before staging-only deployment.
4. Conduct positive and negative callable tests with real staging App Check tokens, Auth verified/unverified, cross-account resource denial, plus rollback and monitoring evidence.
5. Keep public signup closed; no production deploy without independent review and approvals.
