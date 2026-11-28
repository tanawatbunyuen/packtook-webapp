# PACKTOOK — Account Routing V1 Candidate / Security Boundaries

Date 2026-11-28. **Isolated feature branch only. No deploy, no Firestore writes, no public signup.**

## Verified evidence already supplied by owner
- Operator domain policy tests: 9/9 PASS.
- Eight isolated backend handler exports created, 16/16 unauthenticated/unverified-email negative checks PASS.
- No Firebase calls. All previous outcomes are evidence against the **previous branch snapshot**, not automatically the new routing source.

## New in this batch
- `functions/tenant-routing-v1.cjs` defines a non-provisioning, verified-identity tenant resolver. It checks `operatorMemberships/{uid}`, requires matching verified email digest, active status, role and exact owner account, and denies revoked/altered identities.
- Owner fallback only when **no membership record exists**; account must already exist. No automatic `ensureAccount(uid)` or creation for a new operator.
- `requireReservationActor` checks `recordedBy` for finalization and denies one operator modifying a different operator's recording. Missing `recordedBy` is denied for operator; legacy owner records are conditionally accepted.
- `requireBillingOwner` restricts billing to verified owner context; operators do not inherit customer billing rights.
- `audit/fast-track-full-public/tenant-routing-v1-unit.cjs` uses mock database reads and covers 18 expected positive/negative checks. **These new tests have not yet been executed in Cloud Shell.**

## IMPORTANT: still NOT integrated
The new resolver is **not imported into `functions/index.js`**, and existing reserve/finalize/recording/account functions still use their original per-UID routing. It would be unsafe to partially export eight operator functions before integration. A complete, coordinated change must route credits/recordings/devices/status and enforce owner-only purchases consistently.

### Prioritized integration blockers
1. **Invite bootstrap**: ordinary status calls automatically create accounts for new UIDs; invited operator acceptance must precede provisioning or an explicit migration must be implemented.
2. **Atomic authorization**: transactions must read current membership **within the same transaction** before updating shared credits/approvals. Outside-transaction membership checks are vulnerable to revocation races.
3. **Recorder identity**: write `recordedBy` and `accountId` on each new reservation and verify finalization actor; preserve historical owner records without silently moving credits.
4. **Approve/consume**: enforce that the approval requester is the actual authenticated operator; consume the exact pending approval and corresponding request in one transaction. Reject used/expired approvals or cross-tenant identities.
5. **Device scoping**: devices must belong to owner tenant while retaining user binding, per-plan device count and lost-device workflows.
6. **Server-side billing**: callables for plan changes, payment, billing history and owner analytics must remain owner-only where tenant shared identity is introduced; no implicit operator access.
7. **Firestore Emulator**: test two tenants, two operators, revocations during reserve/finalize, simultaneous approvals and interrupted writes; run only locally before scoped staging E2E.
8. **App Check**: 22 existing + 8 additional callable handlers require revalidation, along with client fail-closed and registered-origin token tests.
9. **Payment**: the current branch retains Omise Test Mode; live payment activation requires separate solution.

## Offline next step
Run in a fresh detached feature worktree:
```bash
node --check functions/tenant-routing-v1.cjs
node --check audit/fast-track-full-public/tenant-routing-v1-unit.cjs
node audit/fast-track-full-public/tenant-routing-v1-unit.cjs
```
Expected `PACKTOOK_TENANT_ROUTING_OFFLINE=18/18_PASS`, not yet independently verified.

No change to Gate B3 or release decision. **Full Public = NO_GO.**
