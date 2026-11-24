# P192 — G02 Legacy Account Recovery UX & Controlled Release Compatibility

## Summary
Review-only correction to actual client sources `production/app/app.js` and `production/app/index.html`. When the backend denies Owner role verification, the client displays accessible Thai guidance to contact an administrator for manual owner identity verification, never asks for password and does not claim the customer is Admin. A temporary network/auth check failure offers a retry. Retry is deliberately not shown on explicit permission-denied to avoid repeated unauthorized attempts.

If a duplicate barcode is detected while Owner role is known denied, the interface avoids the unnecessary repeated approval request and returns a deterministic permission-denied error, allowing the existing pending-operation cleanup logic to execute. The **server remains the sole authority** for duplicate approval; unknown role or transient role lookup errors do not grant approval, and the existing server request still decides whether to allow it.

P191 stale-Auth-result guard remains enforced; role and recovery state reset on authentication changes. Video recording, regular barcode reservation, pending-credit recovery, and payment code were not changed.

## Verifiable evidence
The CI tests recovery messages, behavior helper, authentication change, stale result guard, duplicate-denial before prompts, clean deterministic pending-operation rejection, non-deterministic credit reconciliation and parsed frontend JavaScript. Static and isolated helper tests do **not** constitute a real browser or production test.

## Release blockers
No production/staging owner inventory has been executed from this review branch, no real staging valid App Check positive result, no independently verified historical Owner provenance or Security Reviewer signoff. G02 **NO_GO**. Do not merge/deploy, import Owner recovery code, backfill legacy owners, or open signup.
