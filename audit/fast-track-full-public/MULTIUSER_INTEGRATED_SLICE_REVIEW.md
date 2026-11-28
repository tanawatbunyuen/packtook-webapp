# PACKTOOK — Fast Track Multiuser Integrated Backend Slice (SOURCE CANDIDATE — NO DEPLOY)

Date: 2026-11-28. Branch `feature/fast-track-multiuser-integrated-slice`, based on the separately verified operator/atomic-credit candidate.

## Changes made to `functions/index.js` on this isolated branch
- Imported `tenant-routing-v1.cjs`, `tenant-credit-atomic-v1.cjs`, and domain/transaction authorization helpers.
- Attached eight proposed operator `onCall` APIs using `createOperatorCallables(...)`. New browser contract is **22 existing callables + eight new = 30 candidate exports**, plus a separate signed Omise HTTP webhook. Candidate App Check is explicit through base `options.enforceAppCheck:true`.
- Added `creditActor(req)`: identifies a verified member against the owner tenant, keeps owner operations on original single-user path, and blocks status/role/credit/device startup for a verified email with a pending invitation until it is accepted.
- Operator `reserveCredit` and `finalizeCredit` route to the previously Emulator-verified `tenant-credit-atomic-v1.cjs` transaction module. Original owner path stays unchanged for legacy data.
- Operator `registerDevice`, `deviceStatus`, `removeDevice` use tenant-level device inventory and per-operator `registeredBy`; registration and removal re-read membership **inside their transactions**, preventing revoked membership mutations. Legacy owner device paths remain unchanged.
- Operator `usageStatus`, `recordingStatus` and `accountRole` resolve tenant and avoid exposing another operator's recording or owner billing request IDs. `accountRole` gives `operator` with `canApproveDuplicates:false`.
- `ensureAccount(uid)` now refuses implicit separate Free-account provisioning when an accepted operator membership exists (fail-closed for legacy call sites).

## New source integration check
`audit/fast-track-full-public/multiuser-integrated-slice-static.cjs` asserts that all 27 unique browser callable names have matching backend source names, eight operator handlers attached, and eight selected handlers have explicit operator routing. **The tool is static, not executed yet by owner; and does not prove correct runtime behavior.**

## High-priority remaining blockers — NOT SAFE TO DEPLOY
1. **Operator onboarding:** first signup or an unrelated legacy handler can call `ensureAccount(uid)` before pending invite acceptance, because the helper lacks the verified email to inspect `operatorInviteIndex` in those contexts. The new `creditActor` covers only its guarded handler subset. Need a transactional pending-invite bootstrap gate or a separate pre-signup/accept flow.
2. **Remaining function routes:** `pendingVideoReservations`, `recoverStaleVideoReservation`, `authorizeDuplicate`, subscription/billing/payment and owner analytics have not been fully migrated or audited for shared-tenant usage. Some will fail closed; others may still create/operate separate accounts. Review *all* 22 original callables before any staging deploy.
3. **Owner manual duplicate pathway:** original `authorizeDuplicate` approvals do not carry the required operator/request cross-link for `tenant-credit-atomic-v1`. UI must direct operators to owner approval flow, and owners' manual overrides remain a distinct legacy operation.
4. **No actual Firebase callable/Auth E2E:** `index.js` has not been imported by emulator with all new exports; no verified browser reCAPTCHA App Check token; no tenant-scoped test accounts run through the real handlers.
5. **Metadata and plans:** operator device limit uses tenant aggregate count, which may be insufficient for some plan/device policies; registration UX, revocation and dispute recovery need operational design.
6. **Potential legacy impact:** `ensureAccount` now reads membership to deny operator provisioning; adds a Firestore read for existing owner paths. Confirm quotas/errors and provider behavior.
7. **Node runtime:** Functions package targets Node 22 but last operator Cloud Shell run used Node 26. Run with Node 22 plus supported firebase-functions versions before release.
8. **Firestore rules/PDPA/Omise:** direct rules, role permissions, owner billing, Omise live mode and full release safety checks remain unproven.
9. **Immutability:** historic 12-file Hosting review ZIP is unchanged. This source branch is **not pinned**, not approved for merge/deploy and cannot substitute for existing staging revision.

## Local static checks (no Cloud access)
```bash
node --check functions/index.js
node --check functions/operator-callables-v1.cjs
node --check functions/tenant-credit-atomic-v1.cjs
node --check audit/fast-track-full-public/multiuser-integrated-slice-static.cjs
node audit/fast-track-full-public/multiuser-integrated-slice-static.cjs
```

Expected source-only `PACKTOOK_INTEGRATED_SOURCE_CALLABLES=30/30`, `PACKTOOK_BROWSER_CLIENT_BINDINGS=27/27_SATISFIED`, `PACKTOOK_OPERATOR_CALLABLES_WIRED_SOURCE_ONLY=8/8`. All remain pending owner execution.

**Release decision: `NO_GO_FULL_PUBLIC`. Cloud writes 0. No deployment, IAM, secrets, signup or payment changes.**
