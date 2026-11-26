# P231.55 — Isolated App Check runtime test candidate

**Status: offline-tested, NOT DEPLOYED.** Never replace `usageStatus`, `recordingStatus`, `accountRole` or any existing function with this directory. Operate only in `packtook-staging` after separate deployment/IAM review.

## Candidate design
- Unique export `p231AppCheckIsolatedProbe`: Firebase Gen2 `onCall({enforceAppCheck:true})`, Node 22, region asia-southeast1, maxInstances 1, concurrency 1, timeout 10s.
- Requires nonempty SDK-verified `request.app.appId`, authenticated verified-email `request.auth`, and exactly empty data object. Returns only fixed non-sensitive `{probe:'p231-isolated',result:'PASS'}`.
- No Firebase Admin, Firestore, Omise, credits, videos, tokens, secrets or customer data.
- Offline Node unit tests mock Firebase's onCall wrapper: **6/6 PASS**. This does NOT cryptographically verify Auth or App Check, or prove backend enforcement before handler entry.

## HOLD — required before any isolated deployment
1. Confirm explicit scoped authorization for a new isolated staging Function, check export-name collision, service account and least privilege.
2. **Resolve ingress policy:** direct Firebase browser callable invocation normally requires HTTP invocation, while the plan demands non-public access. Review an identity-aware route or isolated test project; do not silently grant public invoker via `--allow-unauthenticated`.
3. Pin release, source and effective dependency versions; no lockfile yet. Review and approve logging, rate limits and cleanup.
4. Confirm legitimate staging user App Check token issuance without logging or copying token values.

## Later E2E gate (same endpoint, request body, authenticated staging user and pinned serving revision)
| Case | Expected evidence |
|---|---|
| Valid App Check | HTTP 200, synthetic PASS and independently verified auth + App Check |
| Missing App Check | Denial **at App Check**, not CORS/IAM/auth |
| Invalid App Check | Denial **at App Check**, not CORS/IAM/auth |

Handler's `request.app` guard is defense in depth and is NOT proof of wrapper cryptographic enforcement. Do not trigger live recordingStatus, credit or payment operations.

## Offline checks
```sh
node --check audit/p231/isolated-test/index.js
node --test audit/p231/isolated-test/test.cjs
```

`P231_ISOLATED_UNIT_TESTS=6/6_PASS` (local verified 2026-11-26)
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
