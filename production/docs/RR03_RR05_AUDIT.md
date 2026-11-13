# PACKTOOK RR-03 + RR-05 — Security and Release-base Integration Audit
**2026-11-13 / DRAFT / NO_GO_RELEASE / PUBLIC CLOSED / NO DEPLOY / NO MERGE**

## Scope and evidence
This audit is **preparation and automated negative checking**, not independent production authorization, external approver verification, a completed PR merge conflict resolution, or a functional repair of P48.

- Current recovery chain PR #23–#32 is open Draft and unmerged.
- GitHub compare `main...review/release-readiness-audit-20261113` returned **status ahead; ahead_by 1022; behind_by 0**, compare API listed **300 files** (possibly capped). This is a substantial unreconciled release-base delta. NOT proof of conflict-free merge or readiness. A throwaway integrated build/reviewer review is still required; do not merge all stacked PRs as a batch.
- Main production payment handler `production/payment-functions/index.js` must **not** import any inactive recovery candidate.
- P58 uses account-scoped policy reads inside Firestore transactions; no trusted role-policy provisioning authority is implemented.
- P57 governance prototype allows role policy seed/revoke in Demo but does **not** establish real user IAM controls; Firebase Admin writes bypass Firestore Security Rules.
- Role custom claims and Firestore role policy are distinct authorities. Need one approved canonical account-scoped role model, shared revocation governance, multi-tenant tests, disabled-user and token-revocation checks, privileged write restrictions and scoped IAM.
- A decision that commits before revocation cannot be retroactively revoked. Define and approve this linearization semantics.
- Existing P48 unknown-plan credit forfeiture report was demonstrated against prior demo handler; no verified release-base functional acceptance for its correction was found during this review. Keep credit/entitlement release **BLOCKED** until verified.

## Delivered safe artifacts
- `rr03-policy-governance-contract.cjs`: validation-only, no policy mutation, no custom claims writer, no release capability; checks tenant scope, independent requesters/approvers, role allowlist, suspended subject and epoch.
- Negative tests for self-approval, role escalation, missing evidence, invalid epoch, suspended account, tenant scope.
- `test-rr05-release-base-static.mjs`: static regression checks for inactive production wiring, policy reads, and explicit P48 not-verified status.
- CI pipeline that runs locally with Node, without credentials or Firebase cloud access.

## Remaining acceptance checks (UNSATISFIED)
1. **RR03 Security owner**: design tenant-scoped role policy writer with IAM authority, two independently verified human approvers; implement allowed transitions and monotonic epochs, audit logs and revocation SLA.
2. **RR03 Engineering**: run end-to-end Firebase Auth/Firestore Emulator tests across tenant boundaries, role claims/token invalidation and concurrent approvals/revocation on candidate build. Do not confuse mock approvals with real signatures.
3. **RR05 Release engineer**: build a throwaway base-integrated tree from explicit release commit and minimum reviewed candidates; compare conflicts and workflow protections. Current 1022-commit divergence requires explicit scope freeze.
4. **RR05 Finance/Engineering**: reproduce P48 unknown-plan wallet behavior on the actual proposed release-base handler, then verify fix persists previously held credits and does not grant credits when plan is unknown; no changes to production balances.
5. **RR05 Independent reviewer**: inspect diff and confirmed regression matrix for billing/payment, wallet, auth, reconciliation and public signup.
6. Separate RR-01, RR-02, RR-04, RR-06, RR-07 staging, independent signoff and pilot gates remain open.

**Decision: RR03 = IN_PROGRESS_NOT_APPROVED; RR05 = IN_PROGRESS_NOT_VERIFIED; NO_GO_RELEASE.**
