# PACKTOOK Omise Test Mode — HTTP 401/403/404 diagnostic hardening

2026-11-14. Owner supplied **real Cloud Run execution** `packtook-omise-test-probe-l8t4z`: `OMISE_TEST_READ_ONLY_VERIFIED: FAIL` and `FAILURE_CATEGORY: PROVIDER_HTTP_NOT_SUCCESS`. This demonstrates the previously pinned image reached a non-2xx Omise HTTP response but **does not prove** why: the previous runner intentionally dropped HTTP status.

## Change
- Maintains the exact single read-only Omise TEST charge GET, no redirects, four-second timeout, explicit staging project allowlist, mounted skey_test_ only, zero real payment operations.
- On non-2xx response report only `PROVIDER_HTTP_STATUS: <numeric 100-599>` or `UNKNOWN`. **Never** include response JSON/text, keys, authentication headers, charge metadata or body in logs.
- Additional offline tests verify 401/404 and prohibit processing or logging provider error bodies; local Docker builds only.

## What to do after this PR passes
1. Inspect Omise Test Mode **Keys** and ensure secret version 1 matches the **same Omise account** as the target Test Charge. A dashboard screenshot cannot establish this.
2. Publish the updated reviewed commit as **a new staging image digest**; do not reuse the previously deployed image digest `sha256:813990148140e6709bb93dc86e303627b393462cb1f2031efcb07215f80ab00b`.
3. Only after operator reviews digest and Cloud Run Job's existing secret mount, update the **staging-only** Job to the new immutable digest.
4. Execute the updated Job at most once; obtain `FAILURE_CATEGORY` and `PROVIDER_HTTP_STATUS` from its logs. 401 suggests invalid/mismatched key; 404 can suggest wrong account/charge; 403 access denial; 429 throttling. Do not assume any one of these absent an observed code.
5. Do not change secret versions, IAM or create/refund any charge in response to an unverified provider error. Do not authorize production release.

No Google Cloud access in this connector session. **PR CI is offline and does not publish, update or execute a Cloud Run Job.** Staging execution already failed and remains failed until new real evidence is collected.

NO_GO_RELEASE / PUBLIC CLOSED / NO PRODUCTION.
