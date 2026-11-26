# P231.131 — Runtime E2E PREPARED, not executed

## Evidence P231.130 (operator, 2026-11-26)

- `P231_FUNCTION_RUNTIME=ACTIVE_EXPECTED_SA`
- `P231_CLOUD_RUN_IAM=ENABLED`
- `P231_DIRECT_PUBLIC_INVOKER_COUNT=0`
- `P231_ACTIVE_OPERATOR_INVOKER_COUNT=1`
- `P231_SERVICE_READY_REVISION_PRESENT=YES`
- `P231_PRIVATE_INVOKER_GATE=PASS_DIRECT_POLICY`
- `P231_SYNTHETIC_STAGING_ACCOUNT=OWNER_CONFIRMED`
- `P231_FIREBASE_AUTH_EMAIL_VERIFIED=PASS_PREVIOUS_BROWSER_OBSERVATION`
- `P231_APPCHECK_BROWSER_TOKEN_ISSUANCE=PASS_PREVIOUS_BROWSER_OBSERVATION`
- `P231_E2E_CREDENTIALS=NOT_GENERATED`
- `P231_RUNTIME_APP_CHECK_E2E=NOT_PERFORMED`
- `P231130_RUNTIME_GATE_EXIT_CODE=0`
- zero IAM/deploy/cleanup changes; `P231_RELEASE=NO_GO`.

These results confirm **readiness infrastructure**, not runtime enforcement. Previous App Check token came from a **temporary independent browser Firebase app**; no end-to-end callable request has been performed.

## Callable + private Cloud Run protocol

Three logically distinct tokens must be present only in the trusted active test process:
- Google-signed IAM audience-specific identity token: `X-Serverless-Authorization: Bearer <GOOGLE_ID_TOKEN>`
- Firebase Auth ID token of explicitly designated verified synthetic staging user: `Authorization: Bearer <FIREBASE_ID_TOKEN>`
- Real staging Firebase App Check token: `X-Firebase-AppCheck: <APP_CHECK_TOKEN>`

Use `POST` and `Content-Type: application/json` and exactly `{"data":{}}` for the isolated Gen2 callable. Do not put Firebase Auth token into `X-Serverless-Authorization` or the Google IAM identity token into `Authorization`. A normal browser Firebase SDK callable does not independently supply a Google Cloud IAM token; the isolated function is intentionally private, so a direct browser call can be blocked at Cloud Run before the App Check layer.

Sources:
- https://docs.cloud.google.com/run/docs/authenticating/service-to-service
- https://firebase.google.com/docs/functions/callable-reference
- https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.callableoptions

## Active E2E case matrix — not yet run

| Case | IAM | Firebase Auth | App Check | Required observation |
| --- | --- | --- | --- | --- |
| A_VALID | valid | valid verified synthetic staging | valid actual staging token | HTTP 200 with exactly `result.probe="p231-isolated"` and `result.result="PASS"` |
| B_MISSING | same valid | same valid | absent | HTTP rejection with callable error indicating App Check failure; corroborate runtime verification/logs, not only code |
| C_INVALID | same valid | same valid | intentionally malformed non-token (not a bearer secret) | HTTP rejection with App Check-related error; corroborate verification/logs |
| D_MISSING_AUTH | same valid | absent | same valid | HTTP rejection at Firebase Auth layer |
| E_MISSING_IAM | absent | valid | valid | HTTP 401/403 at Cloud Run boundary; prior P231.105 anonymous rejection already exists, avoid duplicating unless required |

Never conclude an App Check failure solely from HTTP 401 or 403 because Cloud Run IAM, Firebase Auth, callable protocol and App Check can each reject a request. Maintain same deployed service/revision across A–D. Monitor only this isolated service; no user data mutations.

### Security and operations
- Do not move tokens between the Browser and Cloud Shell using ChatGPT, clipboard-to-chat, bash history, files under the repo, URL query strings, or logs. The existing browser token test intentionally did not retain/export a token. A secure handoff procedure is **not yet implemented**.
- Do not use Admin SDK to mint App Check tokens, use a Debug Token, relax Cloud Run authentication, enable public signup, or grant new IAM.
- The P231.94 approval was limited to 2026-11-26 Asia/Bangkok. If a new active E2E starts after that day, it requires explicit fresh authorization; this document does not grant it.
- Isolated service cleanup still requires distinct approval.
- Production remains NO_GO.

P231131_E2E_MATRIX=PREPARED_ONLY
P231131_RUNTIME_E2E=NOT_PERFORMED
P231131_CREDENTIAL_HANDOFF=NOT_IMPLEMENTED
P231131_RELEASE=NO_GO
