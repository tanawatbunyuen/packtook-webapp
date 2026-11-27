# PACKTOOK — Fast Track Full Public Launch (Gate A / B / C)
**Planning date:** 2026-11-27 (Asia/Bangkok)
**Repo/branch:** `tanawatbunyuen/packtook-webapp` / `review/p231-appcheck-runtime-readiness`
**Decision:** `NO_GO_FULL_PUBLIC`. This document is a workplan, not deployment permission.

## Objective
Reduce repeated phase-by-phase audits by running only **three outcome-oriented gates**. Reuse prior evidence when the same tested code, config, infrastructure and assumptions remain unchanged. Any relevant change invalidates the associated cached PASS. Never equate a static/mock PASS with real browser/integration PASS.

## Release boundaries (strict)
- No Hosting preview, staging or production deploy; no public signup enablement, IAM/Secrets changes, cloud cleanup, migration, billing or user/credit writes without **separate scoped authorization**.
- No real Auth/App Check/business function test initiated under the prior time-bounded staging authorization; arrange fresh approval on the date tests run.
- Never promote from review branch automatically or run unscoped `firebase deploy` (repo `firebase.json` also configures Functions and Firestore).
- Approval to **prepare a plan and offline gates** is not authorization to run, publish or alter production.
- No public launch until ALL blocking checks and independent owner release sign-off are evidenced.

## Evidence already accepted — no repeat without material change
| Area | Reference | Accepted claim | Limits |
|---|---|---|---|
| Isolated App Check enforcement | P231.132 / P231.142 | Isolated E2E 3/3, source 9/9 | Dedicated test callable; not entire client |
| Auth/App Check headers on normal hosted client | P231.148–150 | Hosted normal client request observations, usageStatus 200 | Candidate not exercised, no strict backend token correlation |
| Source parity | P231.168 | 12 assets compared: 9 MATCH, 3 DRIFT (Index/Config/Bridge) | Hosted-only assets not enumerated |
| Reconciliation candidate | P231.169 | Temporary candidate static checks 10/10 | Temporary; cannot deploy |
| Build/syntax/local HTTP | P231.170–171 | Two identical temporary builds, 6/6 syntax, 12/12 local HTTP | No actual browser |
| Security negative mocks | P231.172 | 10/10 fail-closed mock fixtures | No real Firebase SDK |
| Browser preflight | P231.173 | Node/npm YES; Chromium/Playwright NO | Runner and registered origin unavailable |
| Review-only snapshot | P231.174–175 | 12-file ZIP and manifest pinned and tamper checked | Not deployable, lives in temporary /tmp |
| Current Hosted release pin | P231.163–164 | Observed live and FINALIZED at check time | Rollback procedure/restorability not proven |
| Payment/Signup historic | V7.1/V7.2 + later staging notes | Historical component probes | No current end-to-end authorization, Omise staging probe 404 unresolved |

## Gate A — Release candidate & reproducible build (Engineering)
**Inputs:** reviewed source commit, exact Hosting-only deploy config, staging-specific public App Check key provisioning (no secrets in repo), isolated candidate output, verified current live baseline and backup plan.
**Single consolidated job:** reconcile three drifted assets in reviewed source; build a **persistent staging-only candidate**; run code safety/static check, complete file hash manifest, secure config validation, and official CLI packaging comparison. Run mocked browser smoke with disposable browser if runner becomes available.
**Required evidence:**
- `A1` Reviewed bridge/config/index functional diff + source commit (not just copying hosted code).
- `A2` Full candidate manifest, immutable SHA-256, exact deployment scope Hosting-only, secrets scan, config/site-key and public signup closed assertions.
- `A3` Candidate browser smoke under blocked external network with mocked Firebase SDK; no unexpected calls. Runner available or equivalent independently justified browser solution.
- `A4` Exact tested candidate pinned, prepared rollback runbook and recovery artifact/procedure suitable for authorized exercise.
**Exit:** Gate A PASS only after all A1–A4 with reproducible machine-verifiable artifacts. The existing P231.174 ZIP does **not** satisfy A2.
**Owner:** Engineering/reviewer.

## Gate B — Critical real E2E & security (Staging)
**Prerequisites:** Gate A PASS and **fresh, explicit authorization** for staging test origin, test accounts, any preview-channel write and specific backend test operations. If testing a payment feature, Omise **Test Mode** only until separately authorized.
**Single E2E matrix:**
- `B1` Signup rate limit, verified email, login/logout; blocked unauthenticated/unverified users and closed-mode override safety; verify no account enumeration leaks.
- `B2` App Check signed token flows for *exact candidate* on approved registered origin, missing/invalid token rejects, protected callable 2xx only with valid Auth and App Check; correlate individual requests/diagnostic IDs where available.
- `B3` Tenant isolation: user A cannot view/change user B records; Firestore rules and callable authorization deny-by-default and are tested for all critical paths.
- `B4` Packing core: one-device policy, duplicate approval, start/reserve/finalize idempotency, quota accounting (Free 20/month), failure/retry/recovery and video handling; protect personal data.
- `B5` Payment path: if paid plans enabled, Omise sandbox full webhook/authenticity/replay/idempotency/reconciliation, plan updates and refund/error behavior; **the reported 404 staging probe must be resolved**. If payments not ready, disable paid purchase paths and explicitly redefine/approve Free-only Public scope; for **Full Public with paid plans**, B5 is blocking.
- `B6` Negative regression on network failures, browser reload, concurrency, service outage; demonstrate failure modes and recovery without credit double count.
**Exit:** evidence from exact pinned Candidate and test environment, pass/fail logs with redacted identifiers; any unresolved high/critical vulnerability or financial/data-integrity defect => NO_GO.
**Owner:** Engineering + security + finance/payment reviewer.

## Gate C — Production launch controls & independent sign-off
- `C1` Supported and independently rehearsed backup/rollback plan with measured recovery signal, owner/secondary operator and rollback thresholds. Metadata pin alone insufficient.
- `C2` Monitoring alert routing, on-call escalation and smoke probes; Error/Auth/App Check/API/recording metrics, logs retention and incident runbook.
- `C3` Budget and abuse controls (billing budgets/alerts, signup rate limits, quota caps, DoS/automation defense and kill switch), validated fail-closed; alerts alone do not cap charges.
- `C4` PDPA: privacy notice, consent where required, retention/deletion/export procedures, breach handling, contact details and processor inventory reviewed.
- `C5` Release-specific security configuration: least privilege IAM, Secrets, App Check enforcement, allowed origins and functions/Firestore rule review; separate staging/prod config sign-off.
- `C6` Written business owner sign-off for public signup, release scope and production release window; a second named operator confirms go/no-go and rollback readiness.
- `C7` Controlled launch sequence approved: backup and exact artifact pin → scoped Hosting-only deploy → smoke → gated public signup enablement → rollout observation → final launch report. Each **actual action requires its own authorization** here.
**Exit:** C1–C7 evidenced, with Gate A/B current, no unresolved release-blocking risks, explicit written GO.

## Fast Track operating rules
1. Use one integrated evidence table (below), no new P231 phase for each small check.
2. Run cheap independent static tests and source review in parallel; do **not** run E2E before consent/controlled test setup.
3. Stop on first release-blocking failure; fix root issue then rerun affected checks only.
4. Gate A cannot be waved through by reusing P231 offline checks alone. Gate B cannot be replaced by mocks. Gate C cannot be replaced by a self-graded readiness percentage.
5. Final GO is binary. Completion percentages are estimates, not a substitute for release approval.

## Current gate ledger, 2026-11-27
| Gate | State | Primary blocking evidence |
|---|---|---|
| A | BLOCKED | Persistent reviewed deployable candidate, browser runner, complete build manifest, tested recovery plan absent |
| B | BLOCKED_NOT_EXECUTED | Exact candidate real registered-origin/browser E2E, security/credit/payment scenarios and fresh scoped staging authorization absent |
| C | BLOCKED_NOT_EXECUTED | Verified rollback, monitoring, financial, PDPA, security and owner approvals absent |
| Full Public | **NO_GO** | Any gate not PASS |

## Immediate next actionable engineering package
**One PR / one integrated review bundle**, not separate microphases:
1. Reviewer-approved reconciliation patch for Index/Config/Bridge.
2. CI-or-local script to build a complete immutable Candidate artifact and manifest, with no deploy side effects.
3. Browser-runner solution using disposable profile and blocked/mock network initially; isolate and redacted E2E logs.
4. Draft test evidence templates and sign-off records for B/C.
5. After separate approvals, perform actual Gate B and C checks; do not presume they passed.

See `audit/fast-track-full-public/GATE_STATUS.json` and `audit/fast-track-full-public/offline-gate-preflight.py`.

**No external writes were made by this planning work.**
