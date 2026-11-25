# P212 — G02 Local Callable HTTP Auth Boundary (Firebase v2 onCall wrapper)

**Local integration only. G02, G03, production release, and deployment remain NO_GO.**

This test uses exact P188 source SHA256 and the **real Firebase Functions v2 onCall wrapper** plus Express hosting locally on `127.0.0.1:18777`, Firebase Auth Emulator on `127.0.0.1:19099`, and Firestore Emulator on `127.0.0.1:18080`. Firebase Admin SDK verifies Auth Emulator tokens, while the real Firestore emulator executes transactions. The Functions emulator itself is not running; the local Express adapter routes requests to the real onCall wrapper and is therefore *not full Functions Emulator protocol parity*. No App Check or Cloud Run/IAM runtime is tested.

- Positive `accountRole` + `authorizeDuplicate` owner, `usageStatus` new owner and legacy behavior.
- Negative missing token, invalid token, unverified email, wrong owner, missing Owner UID, duplicate approval denied without writes, malformed callable envelope.
- Diagnostics log only HTTP status numbers and error classes; **never tokens or customer data**.
- Retain P168 strict invalid-token 401 versus observed 403 discrepancy if present. A test passes if an invalid token is rejected, but this is **not evidence that the historical G03 strict protocol is fixed**.
- Do not claim P188 is deployed to Staging: deployed revision was dated Nov 7, P188 candidate arrived later.
- GitHub CI tests synthetic local accounts in a demo-only project; no production/staging data, Cloud calls, IAM edits, keys, Omise changes, release or signup actions.

**Next gate closure requirements:** independent G02 security review, evidence of deployed exact code, authorized staging runtime auth positive/negative testing, legacy owner provenance. G03 and G04 remain independently blocked.
