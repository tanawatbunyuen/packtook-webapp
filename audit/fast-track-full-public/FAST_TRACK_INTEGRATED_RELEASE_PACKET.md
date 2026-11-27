# PACKTOOK — Fast Track FULL PUBLIC: Integrated Release Decision Packet
**Version:** 2026-11-27, review branch `review/p231-appcheck-runtime-readiness`. **Overall decision: NO_GO_FULL_PUBLIC.**

## Why this packet exists
Stop endless incremental P231/Gate tests. One integrated owner-facing packet holds the exact remaining decision criteria and evidence. Reuse source/artifact/browser mock tests already completed unless the pinned candidate changes. **No production or staging deploy, IAM/Secrets updates, public signup toggles, account/payment/credit writes are authorized by this document.**

## Locked facts and completed work
- Reviewed Candidate Hosting 12-file ZIP: SHA256 `ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2` (temporary operator workspace; not an approved release bundle).
- Candidate hash 12/12 and local Hosting-only packaging 12/12 + script references 5/5 PASS. Official Firebase CLI Hosting parity **not yet proven**.
- Playwright 1.65.1 and Chromium local mock browser smoke PASS: index 200, Bridge ready, App Check mock init 1, status mocks 2, 0 Firebase calls, 0 JS page errors. **Not real Firebase integration.**
- Static Candidate vs Hosted: 30 async methods, 28 static bindings each, 0 method contract differences. Four Bridge code differences remain; App Check import/setup and fail-closed status behavior differ. Semantic security sign-off remains OPEN.
- Firestore rules file `firestore.rules` has top-level `/accounts/{id}` self-read only, writes denied and the explicit `recordings` and `audit` subcollections similarly. **Not proof of all collections' server access**; Admin SDK Functions bypass rules, and current deployed rules need confirmation.
- Direct repository review of `functions/index.js` SHA `92262ea2fbbb941188937d72f0eea74a735d2bf3`: 23 named exported handlers; 2 `onCall(statusOptions)` with `enforceAppCheck:true` (`usageStatus`, `recordingStatus`), 13 base `options` callables without an explicit flag, 7 other callable policies and 1 HTTP webhook. This means **uniform enforcement is NOT proven**. The payment and owner analytics options also lack an explicit enforce flag in the reviewed source.
- Backend source for `omiseAPI` checks for test secret prefix `skey_test_`; webhook contains method, timestamp and HMAC signature guards. Historic Omise staging read-only probe returned provider HTTP 404; sandbox E2E still OPEN.
- The reviewed `functions/index.js` contains no literal `publicSignup`/signup handler. This is a **repository inspection limit**, not proof that separately deployed signup functions do not exist. Before Full Public, inventory the **real target project's** signup handler and its fail-closed control with separately authorized metadata-only access, and verify that the reviewed release controls it.
- Rollback runbook written but **no rollback exercise performed**. Historic Staging Hosting version metadata alone is not evidence of a supported restore.

## Three gates — remaining blocking deliverables, no repeats
| Gate | Current evidence status | What is needed for PASS |
|---|---|---|
| A1 Source review | 28/28 callable mapping match, four hosted Bridge differences; incomplete | Secure semantic line-by-line App Check + Auth review signed against pinned source; backend App Check policy decision per endpoint |
| A2 Packaging | Offline ZIP/Hosting checks PASS, Firebase CLI parity open | Reviewed full candidate file manifest and supported official Hosting-only packaging/target proof, plus immutable durable recovery artifact. **No unapproved CLI deploy/dry-run** |
| A3 Browser mock | **PASS_OFFLINE_MOCK** | Freeze scope; real SDK/Auth/App Check belongs to Gate B, not repeated mock |
| A4 Rollback | Runbook prepared | Signed exact known-good restore pin, verified supported mechanism and separately authorized controlled rehearsal |
| B1 Auth | OPEN | Real registered staging origin, verified/unverified synthetic accounts, signup-closed negative scenarios |
| B2 App Check | OPEN | Request-correlated enforced+denied valid/missing/invalid token tests for every sensitive backend endpoint; threat-model and explicit policy decisions |
| B3 Tenant | OPEN | Account isolation, own/subcollection Firestore rules, Admin SDK callable tenant isolation and owner custom-claim denial tests |
| B4 Credits | OPEN | Device authorization, 20 free videos, idempotent reserve/finalize, concurrent retries, stale reservation recovery |
| B5 Payments | OPEN | Omise Test Mode 404 resolved; full create/status/webhook signature/replay/idempotency/reconciliation test; paid activation only on verified charge |
| B6 Recovery | OPEN | Real browser reload/network interruption/concurrency/failure behavior with recoverability |
| C1–C7 Release governance | OPEN | Actual rollback proof, monitoring/alerts/on-call, cost/abuse controls, PDPA/retention, IAM/secrets/cross-project controls, owner+independent signoff, approved launch/kill switch |

## Single authorized Gate B test window — proposed scope, **not approved**
- **Project:** `packtook-staging`; isolated **registered** App Check test origin with exact immutable Candidate; **zero production operations**.
- **Users/data:** Two synthetic verified/unverified test identities and distinct synthetic tenants; no customer records, identifiable data or credentials in logs.
- **Operations:** Specific real Auth/Callable/Firestore/Firebase operations listed above; test operations may create/change staging synthetic account/credit/payment records and **require a separate written approval**.
- **Payment:** Omise **Test Mode only**, synthetic paid request lifecycle and webhook negative/replay cases; no actual charge.
- **Before authorized start:** document time window, owner/operator identity, quota/transaction count budget, trusted registered domain, redaction and cleanup, deployment/channel scope if needed. No blanket permission for preview creation, domain changes, IAM, Secrets or Hosting deployment.
- **After approved run:** persist a redacted results table with individual PASS/FAIL, exact source/artefact SHAs, test resource identifiers (redacted) and rollback/cleanup evidence. Any unresolved high-severity defect -> NO_GO.

## Gate C — separate release approvals
One approval for the exact production artifact and Hosting-only rollout does **not** automatically approve enabling public signup. Require **two explicit production decisions** after all gates: (i) scoped production release; (ii) public signup enablement. Any payment service go-live also requires its own business/compliance approval. There is no implied approval from the user telling the assistant to continue Fast Track testing.

## Next engineering batch (offline only)
1. Review canonical Source version for runtime/hosting parity and review four Bridge semantic differences.
2. Decide App Check policy for 13 base and seven other Callable options; review authorization for every sensitive path. Track as one security review signoff, not one P-number per handler.
3. Prepare exact Gate B test fixtures and owner approval document as **one single package**; do not invoke staging until approved.
4. Close Gate C preparations: rollback recovery pin, alerting/budget evidence, PDPA, support/runbooks, business signoff.
5. Reuse A2/A3 tests unless immutable ZIP SHA changes. Stop any progression if current candidate or configured service diverges.

**Release decision:** `NO_GO_FULL_PUBLIC`; public signup remains closed according to operator logs, but no live state was changed or rechecked by this packet.
