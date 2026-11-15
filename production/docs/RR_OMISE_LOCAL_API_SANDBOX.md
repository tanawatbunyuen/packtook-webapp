# PACKTOOK temporary Omise API sandbox

**Purpose:** Verify PACKTOOK's real TEST-only GET charge probe against a synthetic local Omise-shaped HTTP server, completely independent of Omise's external API. Strictly **not** a payment gateway, charge creator, production deployment or proof of live provider health.

Runs only on local `127.0.0.1` with an OS-assigned ephemeral port, uses the non-sensitive fake `skey_test_LOCAL_MOCK_ONLY`, mock test charge `chrg_test_LOCALMOCK0001` and fictional owner metadata. No access to Omise Test Secret from Secret Manager; no Cloud Run Job or Firebase credential is used.

**Test cases:** PAID synthetic test fixture, 404/not_found, 401/bad credential, 500 provider error, wrong metadata, amount, currency, unsafe livemode, pending, POST forbidden, unknown charge ID, missing valid TEST secret. The real `production/omise-test-job/probe.cjs` is imported, and the injection adapter **asserts** the original external Omise URL/method but sends traffic only to the local loopback mock.

Run in an isolated worktree:
```bash
node --test production/omise-test-job/test-local-api-sandbox.cjs
node --test production/omise-test-job/test-probe.cjs production/tests/omise-404-real-handler-offline.test.cjs
```
The mock never grants any credit or updates a subscription. **Important distinction:** the probe's `verified:true` means the retrieved Test Charge matches identity, amount and metadata checks; it does not itself require `paid:true` or `status:successful`, so pending identity verification must NEVER be treated as confirmation of payment. Actual activation in `functions/index.js` requires `charge.status==='successful'&&charge.paid===true`, tested separately.

Real provider remains **404 / not_found** for Test Charge `chrg_test_69jkgjiaft9zvl2pzst`; the user has submitted a sanitized support note to Omise. Passing local mock does not fix this real provider outcome. Provider-dependent feature remains blocked. Do not swap production or staging Omise endpoint to localhost, do not add a mock-acceptance toggle to deployed code, and do not create/credit a synthetic payment in Firestore.

**NO_GO_RELEASE / PUBLIC CLOSED / NO PRODUCTION DEPLOY.**
