# P59 — Genuine Integration Evidence Gates (DRAFT)
**NO_REAL_STAGING_EXECUTION / NO_PROVIDER_CONTACT / NO_DEPLOY.**
This PR implements a fail-closed evidence schema and unit tests, not real Firebase App Check attestation or Omise integration.
Eight independent staging proofs: real App Check token, replay, browser E2E; read-only Omise TEST charge, amount, ownership, livemode false, timeout behavior. Evidence needs reviewer and traceable reference. A verified-shaped submission NEVER authorizes release.
To perform the actual tests, a separately approved isolated staging endpoint, real nonproduction App Check registration, authorized skey_test_ secret in Secret Manager, test-only charge evidence, and independent reviewers are required. Never paste secrets into GitHub or trigger live money flows.
No P58 runtime wiring changes. PUBLIC CLOSED / F0 HOLD / NO_GO_RELEASE.