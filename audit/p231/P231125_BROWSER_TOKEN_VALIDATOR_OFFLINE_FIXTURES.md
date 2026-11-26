# P231.125 — Browser token validator offline fixture verification

The operator previously received `P231_TOKEN_RESPONSE=UNEXPECTED_RESPONSE` in P231.123 because the test harness incorrectly required `AppCheckTokenResult.expireTimeMillis`; the SDK `getToken(appCheck,true)` result documents `token` but does not require expiry metadata. The GitHub script was fixed in P231.124.

P231.125 adds isolated Node.js fixtures that execute the **actual token classification block extracted from the current P231.123 script** with a fake nonempty string, empty string, absent token, null result, and nonstring token. Expected reports are `ISSUED_NONEMPTY` and `TOKEN_ISSUANCE_OBSERVED` only for a nonempty string. Source-policy assertions ensure staging origin/timebox/debug token guards remain in the file and that getToken is forced. No Firebase APIs, real tokens, site keys, source secrets, or network calls are used; the fixture operates on committed source only.

These tests confirm test-harness logic but not browser app initialization, reCAPTCHA attestation, production readiness, or App Check runtime E2E. P231.123 retains date guard for 2026-11-26 Asia/Bangkok; beyond approved timebox active test requires new permission. No Cloud IAM changes, deployments, cleanup or public signup.

P231_BROWSER_VALIDATOR_FIXTURE=AWAITING_EXECUTION
P231_REAL_BROWSER_ATTESTATION=NOT_VERIFIED
P231_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
