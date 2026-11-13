# PACKTOOK P58 — Policy-Integrated Recovery Backend Candidate

**DRAFT / LOCAL DEMO ONLY / NO DEPLOY / NO_GO_RELEASE**

## Implementation
A separate, inactive P58 version of the P54 recovery backend adds account-scoped Firestore policy document checks:
- Maker policy is read within openCase transaction.
- Finance and Technical policies are read within respective review transactions.
- Owner and both historical reviewer policies are read inside the Owner decision transaction.
- Restricted Owner status reads policy before returning a masked case summary.
- Every policy includes accountId, actorId, role, active=true and a positive integer epoch.
- Every decision remains audit-only: no credits, grants, refunds, account/billing writes, unlock, public activation or cloud endpoints.

Policies are seeded by the demo test harness only and stored under accounts/{accountId}/p57DemoRolePolicies. Existing P54 is unchanged and remains isolated.

## Automated verification
- Real local Firebase Auth Emulator ID tokens and revocation.
- Real local Firestore Emulator case/role policy transactions.
- Synthetic one-use App Check tokens and synthetic Omise test GET response.
- Finance, Technical and Owner policy revocations block approval even with valid Firebase Auth custom claims.
- Exactly four case audit events; account/billing documents unchanged; no entitlement grants.

## Critical caveats
- This is **not** a production-integrated authorization solution. Policies are test fixtures; there is no trusted production provisioning and revocation governance.
- Firestore transaction serializability orders overlapping decisions and revocations; a decision that commits before a revocation may remain valid. No retroactive invalidation.
- Real App Check attestation, callable E2E, Omise authorized Test Mode read-only verification, tenant IAM, lifecycle controls, replay/rate limits, MFA, evidence retention, staging secrets and legal approval remain unproven.
- No independent Security / Finance / Legal / Operations / Owner sign-off has been obtained.
- Do not merge stacked draft PRs or deploy until authorized release gates are complete.

## Proposed remaining stages (planning estimate, not a release guarantee)
- P59 — Genuine App Check + Omise TEST-only staging verification and browser E2E, subject to authorized isolated staging and credentials.
- P60 — Security/IAM/Finance/PDPA independent review and release gates, with real Owner decisions.
- P61 — Controlled, reversible production pilot, only with explicit approvals and no automatic recovery settlement.
- P62 — Pilot observation, reconciliation, rollback drill and go/no-go release decision.

The exact number of further phases can change depending on failures, approvals and scope. F0 HOLD / PUBLIC CLOSED / MIGRATION HOLD / NO_GO_RELEASE.
