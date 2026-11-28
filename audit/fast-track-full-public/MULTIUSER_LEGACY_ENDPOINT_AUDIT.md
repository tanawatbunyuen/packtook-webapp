# Multiuser legacy callable audit — Fast Track 2026-11-28

**Operator-verified integration source:** feature branch `3873bb8`: Syntax PASS, static 30/30 callable names, 27/27 browser bindings, 8/8 selected tenant routing branches; exit 0. This is **not runtime E2E**.

## Remaining original callable handlers without new tenant branch

- `pendingVideoReservations`: original per-UID `ensureAccount`; operator status/recovery route must be tenant-scoped and filtered by recording owner.
- `recoverStaleVideoReservation`: original per-UID account/reservation; recovery must enforce same actor, transactional membership, owner-assisted exception path, and wallet refund accounting.
- `authorizeDuplicate`: owner-manual legacy approval; ensure operator cannot approve own request or bypass request/approval linkage.
- `subscriptionOverview`, `billingHistory`, `requestPlanChange`, `cancelUnpaidPlanRequest`: billing and subscription owner-only. Never allow an operator to purchase/cancel billing for a tenant using forged account IDs. Existing UID-local account paths are not a substitute for authorization.
- `omisePaymentConfig`, `createOmisePayment`, `recoverOmiseCharge`, `omisePaymentStatus`, `paymentAudit`: owner-only financial scope and Omise TEST mode need explicit review; callers with old standalone operator accounts might otherwise access their own obsolete billing record.
- `ownerAnalyticsSummary`, `ownerAnalyticsCustomers`: use `requirePlatformOwner` and need independent privileged-claims regression, not tenant-by-tenant rewrite.

The static scanner `multiuser-legacy-endpoint-audit.cjs` lists the 14 original callables without `creditActor(req)` and emits `BLOCKED_UNTIL_OWNER_OPERATOR_DISPOSITION` with exit **3 by design**, not because it failed to run. This new scanner is **not operator-executed yet**.

## Important fail-closed policy before deployment
- **Do not** convert the integrated branch to a deployable release candidate on the strength of static 30/30 checks.
- Audit every account mutation or read that uses `uid(req)`, `own(uid)`, `ownerRef(uid)` or `ensureAccount(uid)`. Accepted operators need either an explicitly allowed tenant-scoped endpoint or explicit owner-only denial. Billing and platform-owner APIs must have separate authentication rules.
- Existing single-owner accounts and historical records must retain their behavior until migration is proven. Do not silently reassign or destroy credits or reservations.
- Keep the eight new operator handlers and shared-credit module off Staging/Production until real Firebase Emulator callable handlers, authenticated tenant isolation, and browser-origin App Check tests pass.
- No Firebase Cloud, IAM, Secrets, customer account writes or public signup changes are authorized by these candidate tests.

**GATE_B3=OPEN; FULL_PUBLIC=NO_GO.**
