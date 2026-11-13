# PACKTOOK RR — Staging Handoff and Local Rollback Drill
**2026-11-13 | DRAFT | NO_GO_RELEASE | PUBLIC CLOSED | NO MERGE | NO DEPLOY**

## Deliverables actually executed by this PR
1. A TEST-only read-only Omise adapter candidate. The adapter has no default network implementation and no secret discovery; it requires explicit injected dependencies. Unit tests mock every request, verify only `GET https://api.omise.co/charges/chrg_test_...`, block live charge/key, validate livemode, handle errors and abort after bounded timeout. **No actual Omise request or credential is used in CI.**
2. A real **local** Firestore Emulator rollback rehearsal in `rrDemoRollbackOnly` namespace only. It simulates closed -> pilot -> closed using revision fencing and persistent audit events. **Not a production rollback rehearsal.**
3. Staging/approvals requirements for RR-01 through RR-07 with exact delegated owner and evidence.

## Human-authorized steps not executed
- **RR-01 Security/Engineering**: create dedicated isolated staging environment and register actual browser App Check (reCAPTCHA Enterprise). Validate limited-use token, one-time consumption, expired token, browser login and callable E2E. Store sanitized logs linked to exact build; independent security review required.
- **RR-02 Finance**: authorize a read-only Omise Test Mode charge ID and test secret in nonproduction Secret Manager; verify amount/ownership, `livemode:false`, rejection and timeout. Never paste secret into PR, CI or chat. Never call a live key, create or refund real charges.
- **RR-03 Security**: review actual deployed IAM, tenant-scoped role policy writer, independent approvals, user-claims revocation, Firestore Rules and App Check enforcement. Source-only checks are insufficient.
- **RR-04 & RR-06 Legal/Finance/Owner**: obtain identity-verified independent signoffs, PDPA data-flow/access/retention and incident-response policies; no programmatic checker can fabricate these approvals.
- **RR-05 Engineering/Finance**: reconcile draft chain and build target against `main`; verify release-base P48 with authorized staging payment reconciliation and compare entitlement ledgers.
- **RR-07 Owner/Ops**: separately authorize controlled pilot, real observability/rollback drills, finance reconciliation. The local drill is not evidence of live backup/restore or zero unreconciled payments.

## Release acceptance conditions
- Genuine provider and browser evidence; separate signer identities; exact reviewed commit SHA; protected nonproduction credentials; scoped allowlist; documented live rollback and alerts; zero duplicate grants, unreviewed refunds or unreconciled provider charges; written Owner GO. These are presently NOT satisfied.

No permission is granted to merge, deploy, open public signup or execute any settlement. F0 HOLD / MIGRATION HOLD / NO_GO_RELEASE.
