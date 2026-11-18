# PACKTOOK P77 — Commercial Operations & Recovery Readiness

**P77 creates an evidence gate, not operational signoff.** All 18 checks
start NOT_VERIFIED and no candidate will automatically mark them verified.

## Required evidence
- GCP Billing budgets, alerts, spending escalation, Functions failure
  rate/latency, Firestore quota and availability alerts
- Omise Test provider probe and signed webhook verification, real provider
  settlement/reconciliation and refunds/disputes procedure
- Credit ledger accounting; restore from a tested backup and immutable
  source/rollback revision
- Incident ownership and drilled response plan, support communications,
  PDPA consent/privacy policy, access controls, video retention and deletion

## Historical blocker
The previous Staging Omise read-only probe returned 404/not_found despite
a prepared Test Secret/Cloud Run job. P76's **synthetic** provider fixture
does not resolve that provider issue. The P77 template therefore leaves
the provider probe unverified; a real provider recheck needs an
independently authorized, credentialed operator session.

Do not paste service account identities, access tokens, complete IAM
policies, personal data or provider secrets into a public PR. Store
attestations privately and record only redacted VERIFIED results.

P74 App Check/IAM gaps and P63 Staging guard drift remain. No deploy,
Cloud reads/writes or Omise calls are made by this CI. The next
offline step is a consolidated P78 release/controlled-pilot readiness
matrix; the operator-only Cloud Shell commands follow separately.
**RELEASE=NO_GO_RELEASE**.
