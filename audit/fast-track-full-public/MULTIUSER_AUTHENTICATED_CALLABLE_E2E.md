# PACKTOOK Fast Track — Authenticated Owner/Operator Callable E2E Candidate (LOCAL ONLY)

Date: 2026-11-28. Historical owner-run tests: 14/14 no-auth HTTP401, exit0 in local Emulator; no valid App Check coverage. This new test **has not been executed**.

`functions/tests/multiuser-authenticated-callable-emulator.cjs` provisions three synthetic users (verified owner, operator and invited outsider) in LOCAL Auth Emulator, seeds synthetic tenant/member/recording docs in LOCAL Firestore Emulator, and invokes actual Functions Emulator HTTP Callables using the synthetic Auth Emulator ID tokens. It checks 15 assertions across:
- Owner account role, operator role and correct tenant ID
- Operator shared wallet usageStatus
- Operator-visible device list limited by registeredBy
- Operator prevented from reading owner's recording
- Operator denied billing, legacy pending reservation listing, and owner-only duplicate approval
- Revoked operator denied role/device status
- Pending invite user denied bootstrap; no accidental standalone account created

Safety: Exact project must be `demo-packtook-integrated-01`; all three Emulator host envs must match localhost or 127.0.0.1. Admin SDK and HTTP requests exclusively target emulator hosts. No Omise, no Secrets, no real customer accounts. **This test DOES create synthetic local Emulator Auth/Firestore data, never cloud data**.

Use existing localhost-only `firebase.emulator-fast-track.json` and run from repository root after `functions` deps exist:

```bash
GCLOUD_PROJECT=demo-packtook-integrated-01 GOOGLE_CLOUD_PROJECT=demo-packtook-integrated-01 \
 firebase emulators:exec --config firebase.emulator-fast-track.json \
 --only auth,firestore,functions --project demo-packtook-integrated-01 \
 'node functions/tests/multiuser-authenticated-callable-emulator.cjs'
```

Expected on success (NOT YET VERIFIED): `PACKTOOK_AUTHENTICATED_EMULATOR_E2E=15/15_PASS` and exit0. Any runtime assertion failure must be diagnosed and resolved in isolated feature source—not bypassed or treated as a pass.

**Limitations:** Operator invitation acceptance itself and positive reserve/finalize through the integrated callable wrappers are not yet covered; browser App Check valid/invalid token runtime enforcement and real Staging/Production remain unverified. Node22 runtime parity remains outstanding. Release `NO_GO`.
