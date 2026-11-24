# PACKTOOK — Production Fast Track (P180)

## Decision (as of 2026-11-24)
**NO_GO_RELEASE / NO_GO_DEPLOY / NO_GO_OWNER_IMPORT / KEEP_PUBLIC_SIGNUP_CLOSED.**

P173–P179 review-only fixtures have reported PASS. These results do not prove prod readiness; P172's 8 source gates remain NO_GO and P180 intentionally cannot clear gates merely by passing CI.

## Minimum critical path — four stages

| Stage | What to do | Acceptance evidence | Parallelization |
|---|---|---|---|
| S1. Security and Authorization (G01–G05) | Root rules exact candidate, backend auth and legacy ownerUid, callable invalid-token protocol, Firebase Admin signature boundary, recovered Owner provenance/exclusion | Reviewer-reviewed source, real staging/emulator negative tests, pinned revisions | Start immediately |
| S2. Cloud/Payment/Monitoring (G06, G07 technical portion) | Prod read-only App Check/IAM/secret inventory, Omise Test Mode 404 diagnosis, webhook idempotency, credit accounting, alerts and billing limits | Redacted read-only operator inventory, reconciliation proofs and alert drill | Parallel with S1 |
| S3. Staging E2E & Restore | Signup & verify, record/credit reserve-finalize-recover, plans/Omise, duplicate/device transfer, backup/restore and realistic pilot load | Signed test run evidence, restore measurement and rollback simulation | Begin when S1/S2 dependencies are available |
| S4. Legal/Owner Approval & Controlled Pilot (G07 legal, G08) | PDPA/Terms/Refund, vendor and payment compliance, documented owner signoff, tightly scoped deployment & signup enable, monitored pilot | External legal review, business owner approval, explicit rollout and rollback instructions | No deployment until all gates passed |

### Minimize scope
- Release only functionality already required by customers; **keep recovered Owner functions out of release** unless independently proven necessary and reviewed. A documented exclusion is preferred over unverified code import.
- Do **not** migrate existing account owners in bulk as a prerequisite to deployment unless risk assessment demonstrates necessity. If migration is necessary, separately approve audited, idempotent transaction and backup/rollback; P179 demo code must not be reused as production migration.
- **One integrated staging test pass** should collect security/payment/recovery evidence rather than repeating isolated phases.
- A green CI means fixtures succeeded. It does not satisfy G06–G08 or substitute for observed staging/prod configuration and human approvals.
- A fixed P173 rules candidate is not proof of production rules deployment.

## Outstanding independently verified actions
1. G01–G05: security reviewer must verify actual release candidate rules/auth and resolve P168 invalid-token 403 vs 401. P171 local unsigned token acceptance is not proof of production signature security.
2. G06: authorized cloud operator performs **read-only** IAM, App Check, Cloud Functions revision, secret binding inventory. Treat anything unobserved as NO_GO.
3. G07: reconcile Omise staging 404, test successful Test Mode card/PromptPay as applicable, webhook replay, credit expiry, failed/canceled flows. Confirm billing alerts and monitoring dashboards. Complete PDPA/Privacy/Terms/refund review.
4. G08: collect **explicit** Business Owner release approval and separate deploy change authorization only after verified gates. No auto deploy or auto enable public signup.

## Rollback conditions
If signup abuse, unexpected auth authorization, failed payment-to-credit reconciliation, missing recordings, billing spikes or alert failures occur, stop onboarding, disable any pilot admissions through authorized runbook, revert to the last verified revision, restore from independently tested backups if needed, and retain auditable incident evidence.

## Release decision rule
A production release is not eligible until every G01–G08 has independently verified supporting evidence, staging E2E and backup/restore pass, **and** authorized release owner explicitly approves the precise change. Evidence acceptance and deploy are distinct operations. All candidate commits in review branches remain unmerged by this change.

## Read-only CI
```bash
node audit/p180-fast-track-check.js
node audit/p172-release-gates.js
```
These validate scope and consistency; they must never flip a release gate from NO_GO.
