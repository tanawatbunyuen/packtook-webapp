# PACKTOOK — Eight Missing Staging Callable APIs: Deployment Gap and Minimum Safe Implementation
Date: 2026-11-28. **Operator-approved metadata read only.** No Cloud writes, calls, deploy, IAM or signup modifications.

## Evidence from owner-operated Staging metadata
`gcloud functions list --project=packtook-staging` returned zero matching names across listed regions for all eight frontend browser-required callables, and zero in `asia-southeast1`. Exit 0; `ABSENT_FROM_LIST` for each. These 8 names were also absent in reviewed `functions/index.js`. This confirms **source + target Functions inventory gap**, not a direct HTTPS request/404 test or a comprehensive inventory of other Cloud Run services.

Missing:
- `inviteOperator`
- `acceptOperatorInvite`
- `listOperators`
- `requestDuplicate`
- `myDuplicateRequests`
- `listDuplicateRequests`
- `approveDuplicateRequest`
- `operatorApprovalStatus`

## Underlying design gap confirmed in inspected source
From feature candidate `functions/index.js`:
- `accountIdFor(uidValue){return uidValue}` and `ownerRef(...)` map every UID to its **own account**, so cross-UID shared operator tenant mapping is not yet implemented.
- `accountRole` returns `{role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false}`.
- Existing `authorizeDuplicate` implements a **same-account, owner-only immediate approval**: it checks the completed barcode lock, validates a 10–500-character reason, writes a short-lived `duplicateApprovals` record and audit entry.
- `reserveCredit` reads `duplicateApprovals` and requires matching approved barcode, expiration, requested-by condition and completed prior recording.
- Thus merely adding 8 named `onCall` functions is **insufficient**: a real operator workflow requires ownership/membership mapping, invitation lifecycle, authorization roles, transaction integrity, and careful account scoping.

## Minimum viable safe implementation design (NEW SOURCE CANDIDATE ONLY)
1. **Tenant and identity:** add account membership mapping `accountMemberships/{uid}` => owner `accountId`, role, status, owner-approved revocation state; never accept `accountId` from client as authority. Owner creates invitations within their own account; acceptance must bind current verified Firebase UID/email to one active tenant. Migration must preserve owner UIDs and never silently reassign existing recordings.
2. **Invitation:** `inviteOperator(email)` writes one invite with token digest (not raw token), expiration and owner+tenant scope; rate limit, audit, strict verified-email match; `acceptOperatorInvite()` validates token mechanism under explicit API contract design. The current Bridge sends **no token** to `acceptOperatorInvite`; decide secure binding via verified-email lookup or UI contract change before implementing. Avoid enumeration across tenants.
3. **Role and listing:** `listOperators()` returns only tenant members to authorized owner; prevent operators from inviting/removing/approving as owner by default; membership revocation and credential refresh invalidation must be tested.
4. **Duplicate approval lifecycle:** `requestDuplicate(barcode,reason)` validates completed lock and reason >=10 characters; create pending request scoped to requester/tenant. `myDuplicateRequests()` filters requester; `listDuplicateRequests()` owner-only; `approveDuplicateRequest(requestId)` owner-only, atomic state transition, expiration and single-use or explicit multi-use rules; `operatorApprovalStatus(requestId)` filters to requester or owner without revealing other accounts. `reserveCredit` must consume approval atomically; cross-tenant and double-spend tests mandatory.
5. **Firestore:** Admin SDK bypasses security rules, so all functions must enforce membership and role server-side. Client direct reads of membership/invites must be explicitly denied unless narrowly designed. Avoid direct client writes; current `firestore.rules` cannot replace Callable authorization.
6. **App Check:** candidate backend requires `enforceAppCheck:true` on all 8 new browser callables, plus the existing 22. The signed Omise HTTP webhook remains separately authenticated, not App Check.
7. **Verification:** offline Emulator cross-tenant/Auth/role/invite expiration/replay/revoke/duplicate-reserve race tests; then approved registered-origin Staging E2E with synthetic accounts. Never create empty placeholder handlers merely to clear the 8 missing exports.
8. **Deployment:** separately authorized Functions staged change + compatible Hosting client + rollback rehearsals. Feature branch is **not** a deployable unified release.

## High-priority release choice
- **Full Public with the current operator/approval UI** requires implementation or verified provision of all eight APIs, tenant authorization and tested workflow; Gate B3 remains OPEN.
- A separate **reduced-scope launch** omitting multi-user/operator and request-approval functionality requires explicit user product decision plus a new reviewed UI build, feature gating and complete retesting of modified contract. It is *not* equivalent to the original Full Public goal and must not be silently selected.

## Security and release
Source candidate's 22/22 App Check offline test remains true for **existing** 22 callables only; adding 8 changes the total and demands new coverage. Current Staging metadata does not prove effective App Check enforcement. `FULL_PUBLIC=NO_GO`, no deployment or public signup authorization.
