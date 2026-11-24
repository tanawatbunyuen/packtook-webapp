# P193 G02 — Headless Chromium Legacy Owner Recovery UI Integration

Review-only browser-integrated tests with Playwright Chromium running **actual production account-panel HTML extracted from** `production/app/index.html`, plus the **exact source of frontend helper functions and retry click handler** extracted from `production/app/app.js`. External resources are blocked and Firebase calls are deterministic in-memory mocks. No cloud API, live tokens, production user records or deploy.

Browser behaviors: permission-denied legacy owner guidance, no retry for explicit owner denial, retry on temporary failure, first server-authorized Admin role after retry, correct reset of recovery elements, stale response from previous user never promoted, duplicate guard fail-closed, no external requests. Static P191/P192 source and P189/P190 original Backend RC guards must remain PASS.

**Limitation**: This is *real browser DOM integration*, not a full hosted production web app E2E with Firebase, credit transaction or actual camera hardware. The external P190 five requirements remain missing. G02 and all eight production release gates remain NO_GO. No merge, deploy, migration, Owner import or signup changes.
