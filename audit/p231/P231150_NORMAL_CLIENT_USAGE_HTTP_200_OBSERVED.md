# P231.150 — Normal staging PACKTOOK client usageStatus HTTP 200 observed

## Evidence provided by operator

The owner shared a Chrome DevTools Network screenshot from the staging PACKTOOK web application (2026-11-26). The screenshot visibly lists multiple `usageStatus` fetch entries, each with HTTP status **200**. It also visibly lists `deviceStatus`, `accountRole`, and `subscriptionOverview` fetches returning HTTP 200. No response body or request headers are exposed in the submitted screenshot.

Prior P231.149 passive browser observer independently reported two normal-client `usageStatus` requests with:
- `P231_OBSERVED_CALL=usageStatus`
- `P231_TRANSPORT=FETCH`
- `P231_APPCHECK_HEADER_PRESENT=YES`
- `P231_FIREBASE_AUTH_HEADER_PRESENT=YES`
- `P231_CREDENTIAL_VALUES=NOT_PRINTED`

## Audit decision

The normal staging frontend has been observed sending App Check and Firebase Auth headers on `usageStatus` fetches, and the developer-tools screenshot shows normal `usageStatus` fetches receiving HTTP 200. Both observations are on the hosted staging client; a strict request-by-request correlation between the two passive-observer messages and particular screenshot rows is **not separately captured**. This is strong evidence for normal frontend HTTP connectivity, but not a standalone proof of the backend validating the App Check token on the exact screenshot requests.

- Normal client `usageStatus` header presence: **PASS — observed**.
- Normal client `usageStatus` HTTP response: **PASS — 200 observed**.
- Response body or semantic business correctness: **NOT VERIFIED**.
- `recordingStatus` normal client runtime: **NOT OBSERVED**.
- Hosted vs repository bridge/config/index source parity: **DRIFT CONFIRMED**, remains unresolved, do not blindly redeploy empty site-key source.
- Isolated private function valid/missing/invalid App Check E2E: 3/3 behavior PASS.
- Isolated source static fixtures: 9/9 PASS.
- Strict individual 401-to-App Check diagnostic trace pairing: 1/2, INCONCLUSIVE.
- Production/public pilot release: **NO_GO** pending independent approvals including legal/PDPA, monitoring, billing, ownership and source-reconciliation procedures.

## Safety boundaries

No new network calls, IAM changes, deployments, cleanup, or public signup enablement were performed by this evidence review. Avoid printing or copying request URLs containing Firebase public API keys, bearer tokens or response details. A Firebase Web API key in a visible request URL is not an Admin credential but should still be omitted from audit excerpts.

P231150_NORMAL_CLIENT_USAGE_APPCHECK_HEADER=PASS_OBSERVED
P231150_NORMAL_CLIENT_USAGE_AUTH_HEADER=PASS_OBSERVED
P231150_NORMAL_CLIENT_USAGE_HTTP=200_OBSERVED
P231150_EXACT_REQUEST_CORRELATION=NOT_ESTABLISHED
P231150_NORMAL_CLIENT_RECORDING_STATUS=NOT_OBSERVED
P231150_SOURCE_PARITY=DRIFT_CONFIRMED
P231150_STRICT_ROOT_CAUSE=INCONCLUSIVE
P231150_CLOUD_WRITES=0
P231150_DEPLOY=NOT_PERFORMED
P231150_RELEASE=NO_GO
