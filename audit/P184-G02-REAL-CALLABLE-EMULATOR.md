# P184 — G02 Real Firebase Callable Transport + Legacy Compatibility

**REVIEW ONLY: NO_GO_RELEASE / NO_GO_DEPLOY / NO_GO_OWNER_IMPORT.**

P184 uses the P183 guarded full-backend candidate built from pinned original `functions/index.js`, plus one explicitly reviewed candidate-only fix for the observed Firebase Admin SDK `FieldValue` import incompatibility (`const {FieldValue}=admin.firestore` replaced with `require('firebase-admin/firestore')`). The original production backend and the P183 generated candidate remain unchanged. The build copies candidate to a disposable functions source and launches official Firebase Functions, Auth and Firestore Emulators in project `demo-packtook-p184` on localhost. This is an integration test of real Firebase callable HTTP transport, real local Auth-issued synthetic tokens and a Firestore Admin SDK transaction. No customer data, cloud deployment, billing calls or recovered Owner handler imports.

The test creates disposable `@example.invalid` Auth Emulator accounts, exercises owner/legacy/foreign/unverified/signed-out/missing-owner and duplicate-approval handler HTTP flows, and removes synthetic Auth accounts. All fixture accounts and audit events remain in temporary Firestore Emulator storage that is discarded at process exit.

## Verified findings\n- In the first real emulator run, the original `FieldValue` import caused duplicate approval to return HTTP 500. The isolated test candidate now uses the supported Admin SDK import and has a passing real transaction test. **This must be incorporated into any separately reviewed production release candidate**; it is not deployed.\n- `usageStatus` enforces App Check and correctly returned HTTP 401 without an App Check token in the emulator. This is a deliberate denial test, **not** a proof of legacy-account status compatibility with a valid App Check token. The combined Auth+App Check path is still untested.\n\nImportant distinctions:
- Real local callable transport is not production Firebase Auth signature attestation. Local Emulator token validation may bypass cryptographic signature verification. P168 G03 invalid-token strict 401 protocol discrepancy remains independent and unresolved.
- Existing accounts without ownerUid lose admin and duplicate approval ability under this fail-closed candidate, though usageStatus remains available. The user-facing compatibility tradeoff requires authorized read-only inventory, independent owner identity provenance, reviewed remediation and backup/rollback.
- Runtime test does not demonstrate App Check, production IAM, actual secrets bindings, or real deployed function revisions. No production `functions/index.js` edits, merges or deploy.
- Do not use P183 candidate in production until G01–G08 independently clear.

Run via GitHub Actions; CI output must report `P184_FULL_CALLABLE_LOCAL_RUNTIME=14/14_PASS` before claiming passing tests.
