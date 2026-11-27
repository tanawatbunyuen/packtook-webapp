# PACKTOOK Fast Track — Gate A closeout + Gate B scoped authorization packet

Date: 2026-11-27. Full Public decision: **NO_GO**. This packet is for review and authorization planning only. It grants no deployment, real account testing, public signup, payment or IAM rights.

## Evidence frozen for this candidate

| Evidence | Status | Acceptance scope |
|---|---|---|
| 12-file artifact SHA `ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2` | PASS_REVIEW_ONLY | Source package integrity |
| Independent archive/manifest check | 12/12 PASS | Archive integrity; no runtime implications |
| Semantic candidate vs staging | Inventory PASS | Index MATCH, 28/28 callable name mapping matches, Bridge 4 different blocks, Config drift; still requires behavioral review |
| Gate A2 Offline Hosting packaging | PASS | 12/12 digests, Hosting-only scope, five scripts; **not** Firebase CLI upload manifest parity |
| Gate A3 Chromium/Playwright | PASS_OFFLINE_MOCK | HTTP 200, Bridge initialized, mock App Check init 1, mock status calls 2, no real Firebase requests, no JS page errors |
| A4 / C1 recovery | RUNBOOK_PREPARED | Recovery or live rollback never rehearsed |

## A1 — concrete engineer security review decisions (not automatically passed)
1. Examine **exact hosted and candidate Bridge difference in four blocks**; classify each as deliberate security strengthening, harmless SDK/UI behavior, or unknown. Obtain reviewer signature for any behavior that changes or blocks authentication/callable execution. Retain repo `protectedApi("usageStatus")` and `protectedApi("recordingStatus")` fail-closed guards.
2. Compare candidate Config against actual existing hosted Config **without publishing key values**. Verify intended staging-only project, allowed reCAPTCHA Enterprise origin/site key ownership, and absence of service-account or Omise secrets. Staging public key injected only into temporary artifact, not committed.
3. Reconfirm backend enforcement for **all** callable mutations, not just two status reads (device, duplicate approval, operator roles, credit reserve/finalize, paid plans); this requires Gate B security tests against an approved staging test setup.
4. Confirm local Client `emailVerified` check has matching server-side authorization. Client checks are not a trust boundary.

**A1 decision**: `OPEN` until review signed by named engineer with source SHA and candidate ZIP SHA. An inventory exit 0 alone is not approval.

## A2 — closeout
Local preflight is PASS but the official Firebase CLI Hosting upload manifest/target and operational behavior remain unproven. Record the exact site, CLI version, Hosting target, immutable release artifact and Hosting-only deploy command **for review**, not execution. No `firebase deploy --dry-run` under no-cloud-write authorization.

**A2 decision**: `PARTIAL` until reviewed CLI packaging parity and artifact approval.

## A3 — closeout
Chromium test proves isolated candidate mock boot only. Candidate on a **real approved App Check registered origin** and Firebase callable/Auth end-to-end remains Gate B.

**A3 decision**: `PASS_OFFLINE_MOCK`, not an unrestricted full application PASS.

## A4 — closeout
Rollback runbook exists in `GATE_A4_C1_ROLLBACK_RUNBOOK.md`. Before execution a reviewer must pin a supported known-good recovery build and verify the **current** release/version and supported restore procedure. A past finalized version ID is not a backup.

**A4 decision**: `OPEN` until appropriately authorized rehearsal and evidence.

## Gate B — one scoped staging-only test authorization for owner review

Proposed scope (not granted): exact candidate pinned by SHA, isolated registered staging test origin, two synthetic verified/invalid Auth accounts, dedicated synthetic test tenant, explicitly named test Functions and Firestore collections, approved maximum number of test transactions, no real customer access, only Omise Test Mode for payment, public signup remains closed, no production project or data changes. Hosting preview upload or domain registration is an actual cloud write and **requires separate explicit permission**.

Gate B consolidated acceptance:
- B1: closed-public-signup safety, verified/unverified Auth, login/logout, anti-abuse and negative tests
- B2: request-correlated App Check token checks (valid, missing, invalid), HTTP response and server confirmation; not just console traces
- B3: multi-tenant Firestore rules and callable isolation, permission denials and tenant boundaries
- B4: one device, duplicated barcode approval, reserve/finalize/retry/recovery, Free quota 20/month without lost/doubled credits
- B5: complete Omise test-mode lifecycle for paid-plan **Full Public**; earlier 404 issue must be root-caused and fixed before PASS
- B6: browser crash/reload, offline interruption, parallel request/idempotency and incident handling

For every test: redacted synthetic account IDs, exact tested source/ZIP SHA, expected vs actual, timestamp, rollback/cleanup boundaries and reviewer name. No unscoped production, billing or database mutation.

## Gate C — prelaunch review packet
C1 supported rollback evidence; C2 alerts and on-call; C3 billing abuse/budget limits (alerts do not hard-cap spend); C4 Thai PDPA and customer data retention; C5 least-privilege security, exact prod config/secrets and App Check registered domains; C6 independent owner signoffs; C7 separately authorized production Hosting operation **and** separately authorized public signup enablement. Failing any item -> NO_GO.

## Decision discipline
NO_GO remains mandatory until all required Gate A/B/C checks pass, reviewer evidence and explicit owner approval are recorded. Do not increase readiness percentage solely because a mock or static check passed.
