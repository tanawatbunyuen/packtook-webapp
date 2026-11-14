# PACKTOOK — Genuine App Check Browser Verification: BLOCKED
Review date: 2026-11-14 Asia/Bangkok.
Test workflow: https://github.com/tanawatbunyuen/packtook-webapp/actions/runs/43603623063
Exact branch commit at time of test: `4d7a5284d06562453b706ea242a68452209126e5`.

## Result
- Real Chromium loaded packtook-staging Firebase app; attempted Firebase App Check SDK `getToken(appCheck, true)` using the already initialized staging provider.
- SDK returned **`appCheck/initial-throttle`**.
- **APP_CHECK_ATTESTATION: BLOCKED/NOT VERIFIED**. Job correctly failed; do not mark this as a pass or assert Staging production-equivalent enforcement.
- This can reflect headless CI reCAPTCHA eligibility, token exchange configuration, domain/site key registration or quota/rate-limit condition; the observed error alone does not identify root cause. Repeated immediate retries are discouraged.
- Token value not logged or persisted. No authenticated Owner session, payment, charge, credit, Firestore write, production deployment or public signup.
- Separately, PR #40's read-only real callable test passed: unauthenticated `accountRole()` returned rejection by Firebase Authentication. This does not prove App Check replay protection.

## Necessary follow-ups
1. Staging operator check Firebase App Check status and registered reCAPTCHA Enterprise site key/domain; diagnose throttling in Firebase/GCP logs (without sharing raw tokens, site secrets, personal data). Verify whether headless automation is supported for this attestation.
2. Authorized owner privately rotates password shown in earlier screenshot before using Owner login. In a supported interactive browser complete a real Owner login, review role/verified email and check callable read requests. Capture redacted evidence only.
3. Reattempt real App Check after the provider throttle window in a supported browser; record only token presence, App ID, expiry and backend verification/limited-use replay status, never token bytes. Backend consume/replay needs an approved staging callable and scoped runner.
4. Omise TEST charge retrieval remains NOT EXECUTED due lack of isolated Test key and approved test charge metadata in this tool session.
5. Separate IAM, legal/PDPA, finance and owner release signoffs remain NOT VERIFIED.

**Decision: STAGING_APP_CHECK_REAL_TOKEN_NOT_VERIFIED / NO_GO_RELEASE / PUBLIC CLOSED / NO MERGE / NO DEPLOY.**
