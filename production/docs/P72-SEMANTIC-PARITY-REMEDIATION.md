# PACKTOOK P72 — Remaining Semantic Parity Remediation

**Status: REVIEW CANDIDATE. Full parity REVIEW_REQUIRED. No deploy or merge.**

## Improvements
- Added shared P72 account semantics preserving Production's `usageStatus` output shape:
  plan, limit, used, reserved, remaining, walletEnabled, walletStartingCredits,
  period, openBillingRequestId, canBuyMore, purchaseReason, planExpiresAt,
  subscriptionStatus.
- Added exact `free/unconfigured/invalid/expired/active` subscription
  classification and applied it to P70 reserve. Staging pre-provisioned
  accounts with active subscriptions can reserve credits.
- Aligned wallet carryover vs legacy monthly counter behavior. Wallet
  remaining credits and reserved amounts survive a period change; legacy
  used/reserved reset for the current period but malformed historical counters
  still fail closed. Missing wallet balance is not interpreted as free credit.
- Preserved duplicateApproval + linked duplicateRequest consumption fix
  from P71 and P70 retry/concurrency invariants.

## Explicit non-parity by design
Production legacy Beta callables may call `ensureAccount` and auto-provision
a Beta account. P72 intentionally **does not auto-provision** any Staging
Pilot account. Only owner-preprovisioned invited users may transact. This
avoids accidental Free credit grants without the independent signup,
consent and anti-abuse policy. An approved Staging client contract/migration
must accept this difference before deploy.

## What remains NOT PROVEN
- Full behavioral parity for all subscription and billing lifecycle states,
  time-bound purchase eligibility, duplicate request ID handling, stale
  recovery races and reservation histories.
- Positively authenticated/valid-App-Check real callable end-to-end success
  on the actual Cloud backend; emulator negative tests cannot prove this.
- P63 deployment drift in existing `recordingStatus` and `usageStatus`.
- IAM runtime roles, Cloud App Check enforcement, monitoring/alerts, PDPA,
  owner/compliance approval, rollback generation, public pilot readiness.

## CI boundaries
Local deterministic tests and demo-project Firestore Emulator tests validate
only named cases. `production/functions/index.js` is unchanged. This branch
does not update production Firebase configuration, does not deploy, does not
merge, and does not access customer data.

`NO_GO_RELEASE` remains mandatory.
