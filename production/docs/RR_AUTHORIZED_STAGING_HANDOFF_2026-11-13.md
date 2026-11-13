# PACKTOOK — Authorized Isolated Staging: App Check + Omise TEST
**Authorization received from owner in conversation on 2026-11-13 (Asia/Bangkok). Scope: strictly packtook-staging; real App Check verification and read-only Omise TEST charge retrieval. NOT production authorization.**

## Current execution state
- Repository has code and CI proof contracts but **no confirmed Firebase staging ADC identity, mounted nonproduction secrets, a real limited-use browser App Check token, or approved test charge mapping accessible to this GitHub connector session**.
- Real provider requests were **NOT executed by PR CI**, and no actual App Check / Omise result is claimed.
- Manual runner `production/scripts/rr-execute-authorized-isolated-staging.mjs` is inactive, has no deployment/export, and fails closed on missing inputs. Only explicitly executes on a trusted isolated staging runner after prerequisites are mounted.
- No production deployment, payment creation, refund, wallet modification or public opening.

## Required authorized staging provisioning
1. Verify **packtook-staging** is a separate Firebase project, not `packtook-prod-01`; confirm project owner/IAM principal and cloud billing/quotas. The existence of a historical project name is not proof of current access.
2. Register the Staging web app with Firebase App Check/reCAPTCHA Enterprise; ensure the test origin is approved. Generate a **real limited-use App Check token** via the registered web client, not a debug token. Protect it as a one-time secret.
3. Configure only narrow App Check verification permissions for the staging runner using workload identity/ADC; never use a service-account JSON key or unrestricted production credentials.
4. Finance authorizes a preexisting **Omise TEST** charge with `chrg_test_` ID and matching expected account/request/amount. Mount `skey_test_` under `/run/secrets/omise-test-secret` from a dedicated test Secret Manager; never paste into PRs or chat.
5. Run the manual CLI in the authorized staging runner with all `RR_*` variables below and public signup confirmed closed; collect only redacted pass/fail logs, exact commit SHA, date and reviewer identity. Do NOT commit raw token or responses.

## Non-secret configuration example
```sh
export RR_STAGING_PROJECT_ID=packtook-staging
export GCLOUD_PROJECT=packtook-staging
export GOOGLE_CLOUD_PROJECT=packtook-staging
export GCP_PROJECT=packtook-staging
export RR_ENABLE_REAL_STAGING_PROBES=I_AUTHORIZE_TEST_ONLY_READS
export RR_PUBLIC_SIGNUP_CLOSED=true
export RR_NO_PRODUCTION_WRITES=true
export RR_APPCHECK_LIMITED_USE_TOKEN_FILE=/run/secrets/appcheck-token
export RR_OMISE_TEST_SECRET_FILE=/run/secrets/omise-test-secret
export RR_STAGING_FIREBASE_APP_ID='1:<STAGING_SENDER_ID>:web:<STAGING_APP_HASH>'
export RR_OMISE_TEST_CHARGE_ID='chrg_test_<APPROVED_TEST_ID>'
export RR_EXPECTED_AMOUNT_SATANG='<APPROVED_TEST_AMOUNT>'
export RR_EXPECTED_ACCOUNT_ID='<TEST_ACCOUNT_ID>'
export RR_EXPECTED_REQUEST_ID='<TEST_REQUEST_ID>'
node production/scripts/rr-execute-authorized-isolated-staging.mjs
```
This command is instructions **for an authorized isolated runner**, not a command executed by this audit. Redacted output must be reviewed externally. Staging browser callable E2E and expired-token tests are separate; this CLI only verifies an actual token consume+replay and Omise TEST charge read with expected evidence.

## Acceptance criteria and external requirements
- Verify first limited-use token consumption succeeds for correct Staging App ID, replay returns alreadyConsumed=true; no debug/bypass.
- Verify only HTTPS Omise `GET /charges/{chrg_test_id}`, livemode=false, THB amount and metadata matching account/request, timeout and invalid-key failure (synthetic test suite). No charge creation, mark-as-paid, refund or settlement writes.
- Run browser callable E2E and expiry separately in an approved isolated environment; link redacted evidence to SHA. Cloud Functions `enforceAppCheck:true` and `consumeAppCheckToken:true` do not automatically deny consumed tokens; the handler must reject `request.app.alreadyConsumed`. See Firebase docs.
- Security/Finance/Engineering/LegalOps/Owner independent signoff and real Pilot remain blocked.

## Official references
- Firebase Cloud Functions App Check: https://firebase.google.com/docs/app-check/cloud-functions
- Firebase callable option: https://firebase.google.com/docs/reference/functions/2nd-gen/node/firebase-functions.https.callableoptions
- Omise charges GET: https://docs.omise.co/charges-api

**Decision: STAGING_AUTHORIZED_BUT_NOT_EXECUTED / NO_GO_RELEASE / PUBLIC CLOSED / NO MERGE / NO DEPLOY.**
