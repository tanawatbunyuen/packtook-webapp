# PACKTOOK — Operator + Duplicate Approval Implementation Candidate (8 APIs)

**Branch:** `feature/fast-track-operator-workflow-candidate`, created from the isolated 22-callable App Check enforcement candidate.
**Scope:** New source-only **non-deployed** implementation candidates in:
- `functions/operator-domain-v1.cjs` — pure Auth/role, invitation and request/approval policy
- `functions/operator-callables-v1.cjs` — actual eight `onCall(options, handler)` implementations, **not exported by functions/index.js**
- `audit/fast-track-full-public/operator-domain-v1-unit.cjs` — 9 policy unit scenarios
- `audit/fast-track-full-public/operator-callables-v1-negative-unit.cjs` — 8 exports and 16 unauthenticated/unverified-email negative cases

## Implemented in source (NOT yet integrated)
- `inviteOperator(email)`: owner-only, email normalized and SHA-256 index, separate 24h pending invitation, no client-supplied tenant authorization.
- `acceptOperatorInvite()`: binds a pending invitation to a current **verified Firebase email** and UID, prevents silently moving an account that already owns resources or has a membership, atomic invite/member/account-operator writes.
- `listOperators()`: owner-scoped listings; no cross-tenant enumeration.
- `requestDuplicate(barcode,reason)`: verified operator membership; 10-500 character reason; requires completed barcode lock; 10min pending request.
- `myDuplicateRequests()`: query scoped to verified current UID inside resolved owner tenant.
- `listDuplicateRequests()`: account owner-only.
- `approveDuplicateRequest(requestId)`: owner-only; rejects self-approval, expired, already acted-on or incomplete recording, checks active requester membership, creates 5min approval atomically.
- `operatorApprovalStatus(requestId)`: owner or original requester only, returns approval status/ID.

Candidate paths: `operatorInviteIndex/{sha256(normalizedEmail)}`, `operatorMemberships/{uid}`, `accounts/{ownerUid}/operatorInvites/{emailHash}`, `accounts/{ownerUid}/operators/{operatorUid}`, `accounts/{ownerUid}/duplicateRequests/{requestId}`, `accounts/{ownerUid}/duplicateApprovals/{approvalId}`, `accounts/{ownerUid}/audit/{id}`. Existing account credit wallet and recording paths are unchanged.

## CRITICAL block before wiring to index.js
**Do not import or export these eight API handlers as deployable yet.** Existing `accountIdFor(uid){return uid}` and `accountRole` return owner/admin for each UID. `reserveCredit`, `finalizeCredit`, `pendingVideoReservations`, `recordingStatus`, `deviceStatus`, `recoverStaleVideoReservation` and payment/account handlers assume specific owner/account paths. Even with 8 named handlers present, operator video reservations would currently use the operator's **own** account, while approval records live under the **owner** account.

There is also a bootstrap conflict: normal first-login `usageStatus` invokes `ensureAccount(uid)` and could create a Free account for an invited operator before they call `acceptOperatorInvite`; this candidate deliberately rejects transfer of that newly created account to avoid credit loss. The App UI signup/login flow must be updated so an invited verified operator can accept before any owner account is provisioned, or a safe transactional migration workflow designed.

Other work mandatory before integration:
1. Define **authoritative server-resolved account mapping** for *all relevant* account/device/recording/status/credit operations, including operator revocation checks, tenant-owner binding and billing owner-only privileges.
2. Ensure `reserveCredit` and `finalizeCredit` use the same authorized tenant and enforce that only the reserving operator/owner can finalize each recording. Attach `requestedBy` and consume duplicate approval/request transactionally. Existing `reserveCredit` compares `approval.requestedBy` to `id` which today is caller UID; when tenant ID becomes owner UID, this comparison must remain bound to actual operator identity.
3. Add **operator revocation** and membership state updates before Full Public, including stale Auth sessions and no direct client writes.
4. Review invite enumeration/abuse rate limits and notification mechanics; current `acceptOperatorInvite()` receives **no invite token** from Bridge; binding relies on a unique, normalized verified email hash index. Define how an invited user learns to accept without revealing email hashes.
5. Audit Firestore rule exposure and Admin SDK bypass; operator reads and membership mapping must be enforced in server handlers.
6. Test transaction read-before-write, replay, request approvals, duplicates, status polling, multiple sessions, revoked membership, concurrent claims and cross-tenant attacker scenarios in the **Firestore/Auth Emulator** before any Staging permission to write test data.
7. Update the API Contract scanner to expect a unified **30-callable** backend candidate only after integration and independently reviewed source; currently 22 exported callables + 8 non-exported draft handlers.

## Fast Track next engineering batch
Integrate owner/operator routing into credit/device/recording endpoints as **one coordinated patch**, add Emulator tenancy + role denial E2E, and only then connect these eight handlers in `functions/index.js`. Do not deploy partial account-routing migration. The older Hosting 12-file pin remains unmodified.

## Current test/run commands in a detached feature worktree
```bash
node --check functions/operator-domain-v1.cjs
node --check functions/operator-callables-v1.cjs
node --check audit/fast-track-full-public/operator-domain-v1-unit.cjs
node --check audit/fast-track-full-public/operator-callables-v1-negative-unit.cjs
node audit/fast-track-full-public/operator-domain-v1-unit.cjs
node audit/fast-track-full-public/operator-callables-v1-negative-unit.cjs
```

**Release conclusion:** `NO_GO_FULL_PUBLIC`. Source-only implementation candidate, not approved source of truth, not deployed, no Staging data touched.
