# PACKTOOK P53 — Production Payment Review Recovery Architecture (PROPOSAL ONLY)

> **Status:** DRAFT DESIGN. Nothing in this PR is an enabled production endpoint. Do not merge, deploy, change IAM, settle a customer charge, alter wallets, release billing locks, refund money, activate F1–F3 or open Public Signup without separately scoped Owner approvals.
>
> Upstream: PR #20 credit hardening (DRAFT) and PR #21 review-only dual-control prototype (DRAFT). P52's synthetic \`checks.*\` and \`authorizedByTrustedServer\` flags are NOT production authorization.

## 1. Core guarantees and constraints

1. **Never create money or credits from a callback alone.** A trusted server independently retrieves an Omise charge using a secret held only by the backend, checks test/live-mode separation, account ID, request ID, plan price, amount in satang, currency THB, method PromptPay, successful+paid state and original billing evidence.
2. **Provider network I/O occurs BEFORE, never inside, a Firestore transaction**; retrying a transaction cannot replay a charge/refund API call. Revalidate a short-lived provider evidence digest and ALL current account/bill/ledger values inside the final transaction.
3. **Distinct humans and separation of duty.** Maker opens a case; finance checks payment ledger; technical checks entitlement safety; Owner independently authorizes a resolution. No actor may approve their own case or their own customer account. Verify roles server-side on every action against refreshed Auth user + independently administered role grants, not client-posted role booleans.
4. **Do not trust stale snapshots.** Revoke/restart approvals when billingVersion, wallet, reservation count, billing lock, billing record, provider status/evidence or verified user/role state changes; review TTL is 15 minutes in the P52 mock, adjustable only by reviewed policy.
5. **Exactly-once entitlement record.** A future approved executor must transactionally create a deterministic grant ledger document (\`entitlementGrants/{requestId}\`), update the account, billing record and immutable audit in the SAME transaction after reading every guard. If grant exists: no extra credits; return a sanitized idempotent result or flag conflict.
6. **Retain the billing lock until a confirmed resolution** and never silently clear \`payment_review\`. Consider separate outcomes ENTITLEMENT_RECONCILIATION, MANUAL_PROMPTPAY_REFUND_ESCALATION and FRAUD_OR_DISPUTE_HOLD.
7. **PromptPay refund constraint:** Omise's PromptPay guide states PromptPay charges cannot be voided or refunded through Omise. Do NOT implement an Omise PromptPay refund endpoint. Finance must use a separately approved out-of-band bank/payment process and attach proof with minimum necessary sensitive data, with a second check; mark case as resolved only after externally confirmed completion and matching ledger. This route must not award entitlements.
8. **Production remains closed**: current code uses \`PACKTOOK_PROMPTPAY_TEST_ENABLED\` and requires \`skey_test_\`; any future live-money architecture is a separate future proposal. There is NO live money execution in P53.
9. **The owner may opt to defer independent PR review for more *development* only.** This does not mark Human Review PASS, and cannot justify a merge, deploy or public release.

## 2. Trust boundary and high-level diagram

\`\`\`mermaid
flowchart LR
  A[Owner web app] --> B[Firebase Auth + App Check]
  B --> C[Recovery callable API - disabled until approved]
  C --> D[Server-side Auth & Role Grants]
  C --> E[Omise GET Charge - test only until live approval]
  C --> F[Case and snapshot store - Firestore]
  D --> F
  E --> F
  F --> G[Finance human review]
  G --> H[Technical human review]
  H --> I[Separate Owner resolution decision]
  I --> J{Resolution}
  J -->|Entitlement after future executor approval| K[Atomic wallet and grant ledger transaction]
  J -->|PromptPay manual refund| L[Finance offline refund plus evidence]
  J -->|Mismatch or dispute| M[Escalate and retain lock]
  K --> N[Immutable audit and notification queue]
  L --> N
  M --> N
\`\`\`

The diagram depicts a **future architecture**, not currently deployed callables.

## 3. Proposed callable API contracts (all NOT IMPLEMENTED)

| Function proposal | Actor | Input | Output | Mutation boundary |
|---|---|---|---|---|
| \`recoveryCaseOpenV1\` | maker/Owner | \`requestId, caseOperationId, reason\` | masked case status | Creates case only, never wallet |
| \`recoveryEvidenceRefreshV1\` | technical/finance | \`caseId\` | evidence digest, masked provider status | Omise GET server-side + append redacted evidence |
| \`recoveryReviewV1\` | finance OR technical | \`caseId, evidenceHash, decision, reason, requestIdempotencyKey\` | accepted review state | Append role-signed review only |
| \`recoveryOwnerDecisionV1\` | separate Owner | \`caseId, resolutionType, evidenceHash, decision\` | decision recorded | Authorizes *proposal*, never settles |
| \`recoveryStatusV1\` | restricted Owner/finance/technical | \`caseId\` | masked case and action requirements | Read-only |
| \`recoveryEntitlementApplyV1\` | future service-controlled executor only | \`caseId, approvedResolutionId\` | idempotent result | **NOT part of P53**, separate gated implementation |
| Manual PromptPay refund | authorized Finance + independent checker | external financial workflow | verified refund proof | **NO Omise refund API** and not part of P53 |

All future callable endpoints MUST explicitly set \`enforceAppCheck:true\`; consider \`consumeAppCheckToken:true\` for sensitive low-volume actions after IAM and client compatibility verification. If token is already consumed, reject explicitly. App Check is NOT a substitute for authorization. Service account permissions must be minimal and separately approved.

## 4. Firestore data model (proposed)

- \`accounts/{uid}/billingRequests/{requestId}\`: existing immutable provider-paid evidence fields, \`status=payment_review\`, \`openBillingRequestId\` on the parent account.
- \`accounts/{uid}/recoveryCases/{requestId}\`: deterministic id protects duplicate case creation. Fields \`schemaVersion=1\`, \`state\`, \`caseRevision\`, \`makerUid\`, \`requestedResolution\`, \`providerFingerprint\`, \`accountFingerprint\`, \`evidenceFingerprint\`, \`providerObservedAt\`, \`evidenceExpiresAt\`, \`billingVersionAtOpen\`, \`billStatusAtOpen\`, \`createdAt\`, \`updatedAt\`, \`ownerDecision\`, \`resolutionType\`. Never store the Omise API key or raw bank credentials.
- \`accounts/{uid}/recoveryCases/{requestId}/reviews/{finance|technical}\`: deterministic role doc; \`reviewerUid\`, \`role\`, \`evidenceHash\`, \`decision\`, \`reasonCode\`, \`roleVersion\`, \`createdAt\`. Both reviewer UIDs must differ from maker, beneficiary and each other. Do not infer authorization from the existence of these docs.
- \`accounts/{uid}/recoveryCases/{requestId}/events/{eventId}\`: append-only event, actor, before/after state, hash and timestamp; no secrets or full personal data in logs.
- \`accounts/{uid}/entitlementGrants/{requestId}\`: future deterministic idempotency ledger for a ONE-TIME entitlement application, keyed to \`chargeId\`, \`billId\`, \`caseId\`, \`amount\`, \`before/after balance\`, \`billingVersionBefore/After\`, \`grantAlgorithmVersion\`. **P53 never writes this collection.**
- Manual refund evidence should use least-privilege access to separate protected storage; Firestore stores evidence identifiers, checksums, review status and retention metadata, not bank-account screenshots.

Never query all accounts to determine approval rights; check server Auth/user records and an independent role-grant authority with audit records. Security Rules must deny direct client writes to billing/recovery/grant/audit collections; all actual changes happen server-side through approved IAM-scoped functions.

## 5. Reconciliation and atomicity

**Preparation:** Obtain fresh charge via Omise GET using server test key, verify every invariant, calculate canonical digest, read account/bill/grant state, and present masked evidence to reviewers. No external POST money actions.

**Final execution — future feature only:** Acquire fresh signed Owner decision and trusted role status, re-fetch provider evidence outside the transaction; inside one Firestore transaction read account, bill, recovery case, both role reviews, owner decision and \`entitlementGrants/{requestId}\` BEFORE any writes. Check exact \`evidenceHash\`, status \`payment_review\`, \`openBillingRequestId=requestId\`, unchanged \`billingVersion\`, \`reserved=0\`, balance and signed safe integer arithmetic, current plan/expiry, no duplicate grant, and no concurrent refund resolution. Then write account, bill, ledger, case and audit atomically. On contention retry re-read; on uncertain result retry same deterministic operation ID and inspect ledger (never blindly grant again).

**Manual PromptPay refund:** It is a separate, out-of-band workflow that cannot race against entitlement resolution. Set one mutually exclusive resolution election transactionally before any external payment; Finance submits evidence, independent checker confirms bank confirmation and matching amount, then a separate final case/ledger update. Never claim a refund occurred merely because a request was created.

**If the provider disagrees, evidence expired, the account changes, charge has any already-refunded indicator, or role revocation is suspected:** stop and escalate. No unlock, no entitlement and no "auto-repair".

## 6. State machine for policy review

\`\`\`
PAYMENT_REVIEW
  -> EVIDENCE_VERIFIED
  -> AWAITING_FINANCE_AND_TECHNICAL
  -> DUAL_REVIEW_COMPLETE
  -> OWNER_DECISION_RECORDED
  -> (separate, future approved executor) EXECUTED_AND_RECONCILED
  -> CLOSED

ANY_NONFINAL_STATE -> ESCALATED (irreconcilable or stale)
ANY_NONFINAL_STATE -> CANCELLED (owner-confirmed no execution)
\`\`\`

The P53 sample model only reaches \`OWNER_DECISION_RECORDED\` with \`action=NONE\`. It CANNOT reach an executed/closed state, and stores no production data.

## 7. Monitoring and governance

- Suggested alert classes: \`paid_review_open_24h\`, \`provider_paid_mismatch\`, \`dual_review_so_duty_violation\`, \`idempotency_duplicate_attempt\`, \`billing_lock_stuck\`, \`manual_refund_unverified\`, \`owner_decision_expired\`.
- Structured logs: case ID/hash, reason code, actor role category; do not write raw charge response, customer names, emails, bank accounts, or tokens.
- Operational metrics: case age buckets, paid-but-unresolved THB exposure, manual refund evidence aging, entitlement reconciliation latency; financial materiality and alert thresholds require Ops/Finance signoff.
- Case evidence retention, customer notice, dispute handling and data-subject rights require Legal/PDPA signoff. Never claim draft Terms/Privacy are approved.

## 8. Required signoffs and launch gates

1. Independent technical review of PR #20, PR #21 and this P53 architecture.
2. Finance approves ledger reconciliation and **manual** PromptPay refund policy; Technical approves double-entry/idempotency and failure rollback; Owner signs dispute/exception policy.
3. Security approves roles/MFA, revoked-token handling, IAM, App Check callable + browser E2E, Firestore Rules and abuse tests.
4. SRE/Ops approves alerts, notification delivery, budget, LKG image digests, rollback rehearsal and source-to-deployed provenance.
5. Legal approves Privacy/Terms/retention.
6. Only after all gates, approve and implement executor in a separate PR, staging emulator and controlled pilot. A passing architecture/model CI does not deploy any endpoint.

**Today: F0 HOLD; F1/F2/F3 NOT_AUTHORIZED; PUBLIC CLOSED; MIGRATION HOLD; NO_GO_RELEASE.**

## Official reference material

- https://docs.omise.co/promptpay (PromptPay refund/void limitation)
- https://docs.omise.co/charges-api/thailand (verify payment using independent GET)
- https://firebase.google.com/docs/firestore/manage-data/transactions (transaction retries + read-before-write)
- https://firebase.google.com/docs/app-check/cloud-functions (enforcement, optional replay protection)
- https://firebase.google.com/docs/auth/admin/custom-claims (do not trust client-supplied role fields)
