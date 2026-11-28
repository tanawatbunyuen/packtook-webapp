# PACKTOOK Fast Track — Legacy Endpoint Disposition Candidate

Date: 2026-11-28. Following owner Cloud Shell audit @6ab733a, 22 original onCall handlers split into 8 tenant-routed and 14 unreviewed. Audit exit 3 was **intentional** and correctly identified 14 endpoints.

## Source change (feature candidate only)
At the **entry** of twelve original handlers, add `await requireLegacyOwnerAccess(req)` before original account/billing/recovery logic. The guard:
1. Requires verified Firebase authentication using `uid(req)`.
2. Checks whether a membership document exists at `operatorMemberships/{auth.uid}`, denying all accepted, revoked and malformed operator memberships (fail closed).
3. Checks `operatorInviteIndex/{SHA256(normalized verified email)}` and denies a still-pending unexpired invite to avoid creating an independent Free account during onboarding.
4. Does not perform Firestore writes. Original owner-only behavior remains otherwise unchanged.

Owner-only handlers: `pendingVideoReservations`, `recoverStaleVideoReservation`, `authorizeDuplicate`, `subscriptionOverview`, `billingHistory`, `requestPlanChange`, `cancelUnpaidPlanRequest`, `omisePaymentConfig`, `createOmisePayment`, `recoverOmiseCharge`, `omisePaymentStatus`, `paymentAudit`.

Two remaining original handlers, `ownerAnalyticsSummary` and `ownerAnalyticsCustomers`, continue to use their stricter preexisting `requirePlatformOwner(req)` claim gate. They are not regular tenant owners.

## Tests

New static source-only check: `audit/fast-track-full-public/multiuser-legacy-disposition-static.cjs` validates the 12 owner entry gates and 2 platform-owner gates. **Not executed by owner yet.** The prior `multiuser-legacy-endpoint-audit.cjs` remains a historical **intentional exit 3** inventory, not an updated release check.

```bash
node --check functions/index.js
node --check audit/fast-track-full-public/multiuser-legacy-disposition-static.cjs
node audit/fast-track-full-public/multiuser-legacy-disposition-static.cjs
node audit/fast-track-full-public/multiuser-integrated-slice-static.cjs
```

Expected (not yet verified) `PACKTOOK_LEGACY_CALLABLE_DISPOSITION=14/14_STATIC_PASS`.

## Blockers still open

- **Operator stale recovery/pending reservations** currently denied rather than tenant-routed. Must implement a separate owner-assisted, audited recovery flow. Do not enable generic recovery for operators.
- **Legacy duplicate approval** remains owner-only and is incompatible with the distinct operator approval request token, which requires dedicated UI/flow verification.
- **Existing owner account bootstrap:** New/accepted operator with a preexisting standalone account cannot accept invitation automatically; explicit transfer/merge or admin review needed. Account provisioning is NOT proven race-free across all entrypoints.
- **Runtime:** No authenticated callable emulator negative tests for the integrated `functions/index.js`; no App Check runtime evidence for all 30; prior 5/5 Emulator test directly called the isolated credit module only.
- **Payments:** No live Omise, Cloud Secrets, Cloud IAM, release approval, staging data writes or production activation.

**RELEASE=NO_GO.** No Deploy and no Cloud writes.
