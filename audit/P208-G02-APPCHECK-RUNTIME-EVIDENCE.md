# P208 — Real Staging App Check Evidence Readiness (NO_GO)

**Status:** Offline review-only; not a live App Check test. G02 NO_GO / NO_GO_RELEASE / NO_GO_DEPLOY / KEEP_PUBLIC_SIGNUP_CLOSED.

## Baseline and trust boundary
Target Firebase Gen2 callable: `projects/packtook-staging/locations/asia-southeast1/functions/usageStatus`; official Cloud Functions URL `https://asia-southeast1-packtook-staging.cloudfunctions.net/usageStatus`. Pinned reported revision `usagestatus-00021-nob`, build `8dc6958c-b6dc-4188-a675-2740b18f7098`. This revision was deployed before the isolated P188 candidate, and cannot establish P188 runtime code.

User-supplied revision ACTIVE/Ready and image digest metadata are not an independent attestation of request routing. The verifier does **not** access endpoint, generate tokens, fetch Auth records, or check external IAM.

## Independent security reviewer procedure (only within a separately authorized Staging test)
1. Verify the intended staging project/function and active revision independently from original trusted provider records; do not confuse Cloud Functions official URL with Cloud Run service URI.
2. Define a safe, non-mutating callable test body and an approved test-only identity. Confirm expected Firebase callable POST format and how Auth and App Check enforcement should behave on that specific handler.
3. Collect three comparative cases: **MISSING_TOKEN** (absent App Check token), **VALID_TOKEN** (legitimate staging token with expected Auth context), **INVALID_TOKEN** (intentionally invalid safe test token). Never print real tokens, credentials, UID/email or response body in PR, CI, chat or logs.
4. Capture sanitized outcomes separately: timestamp, 2xx/4xx status, handler result class, test scope/ticket, trusted proof/reference kept outside GitHub, and exact revision routing evidence.
5. A 403 response may be caused by Auth, IAM, application checks or App Check. **It does not alone prove App Check enforcement**. A 200 response may not independently prove a valid token. Same comparison is necessary but insufficient without original trusted provenance, enforcement configuration, handler semantics and reviewer identity.
6. For a callable, transport response and Firebase `HttpsError` mappings vary; the report's expected 200/401/403 observations are test-policy expectations and **not universal App Check guarantees**. A deviation should be investigated, not falsely counted as a production failure or positive attestation.
7. Preserve immutable release gates; security reviewer independently checks original evidence and source-to-revision linkage. P188 candidate not known deployed.

## Deliverables
`audit/p208/verify.js` accepts only narrow sanitized metadata; it classifies MISSING_TOKEN, VALID_TOKEN and INVALID_TOKEN; rejects project/URL/revision/build/candidate drift, unexpected request method, raw token/PII fields, duplicate cases and synthetic fixtures represented as real evidence. Even all 3 claimed passes remain **CLAIMED_NOT_INDEPENDENTLY_VERIFIED** and G02 NO_GO.

No merge, deploy, production read/write, IAM change, App Check policy change, user creation, Omise action or public signup.
