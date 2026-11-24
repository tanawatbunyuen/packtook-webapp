# P181 — Production Security Critical Path: G01–G05

**NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY / KEEP_PUBLIC_SIGNUP_CLOSED.**

## G01: exact root firestore.rules
P173 review branch candidate Git blob `52e207280059e5700da77add9e4af45971c94557` includes a single semicolon fix. P181 runs the exact source in an isolated **Firestore client SDK** emulator on localhost (rather than only static source assertions or Admin SDK). 17 owner/cross-tenant/guest/list/write/claim tests. This checks local authorization semantics only; no prod rules deployment and no real customer data. G01 remains NO_GO until signed release diff and cloud configuration evidence.

## G02: customer admin/owner authorization
Pinned backend blob `92262ea2fbbb941188937d72f0eea74a735d2bf3` has `accountIdFor(uidValue){return uidValue}` and `assertAdmin` checking `accountId!==uidValue`; the latter condition is dormant under the current mapping. A duplicate approval handler bootstraps absent `ownerUid` by writing `ownerUid:accountId`. P174–P179 were review-only guard/migration candidates and MUST NOT be interpreted as production fixes. Preserve G02 NO_GO pending reviewed role policy, legacy migration resolution and real handler negative tests.

## G03: Callable HTTP invalid token
P168 invalid token returned HTTP 403/PERMISSION_DENIED and entered a demo handler vs protocol expected 401/UNAUTHENTICATED. No privileged mock reads occurred. This is a local emulator observation and may be debug-mode behavior; do not silently reclassify as conformant. Need pinned SDK/CLI and production-equivalent stage verification (no malformed production Owner tokens or unauthorized deploy).

## G04: Firebase token signature
P171 local Auth Emulator accepts some unsigned synthetic local tokens; it is not real production cryptographic attestation. An operator-verified staging check of actual Firebase Admin verification, issuer/audience, revocation and policy is required, without exposing tokens.

## G05: recovered Owner function provenance
Four recovered Owner functions remain excluded. Minimal-scope recommendation: keep them excluded from first release, record source/revision and negative import checks and obtain security acceptance of exclusion. If the live production revision already contains them, do not assume exclusion from the review branch suffices.

## Remaining
G06: authorized production App Check/IAM/secret/runtime inventory. G07: Omise staging 404 resolution, billing alerts, monitoring, legal. G08: explicit owner go/no-go.

**CI green means G01 emulator semantics only. All P172 gates stay NO_GO.**
