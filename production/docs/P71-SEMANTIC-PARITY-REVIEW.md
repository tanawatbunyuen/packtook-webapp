# PACKTOOK P71 — Production vs P70 Staging Semantic Parity Review

**Review status: REVIEW_REQUIRED. Deploy allowed: NO. Production release: NO_GO_RELEASE.**

P71 compares the original source `production/functions/index.js` and the
rewritten P70 Staging candidate `production/staging-candidates/p69/functions/`.
This is a scoped code audit and targeted emulator test matrix, not full
formal equivalence or proof of runtime transport enforcement.

## Findings

| Priority | Scope | Finding | Outcome |
| --- | --- | --- | --- |
| HIGH | Duplicate approval | Original reserve updates `duplicateApprovals` **and** linked `duplicateRequests`; P70 initially updated only approval | **Candidate patched in P71**, covered by a dedicated emulator test |
| HIGH | Account provisioning | Production reserve, usage and recovery use `ensureAccount` to provision authorized Beta account; candidate assumes account exists | **UNRESOLVED** — decide explicitly whether Staging pilot is pre-provisioned only |
| HIGH | Subscription semantics | Production uses `subscriptionState` with precise invalid/unconfigured/expired classification. Candidate simplifies paid-plan check | **UNRESOLVED** — compare paid/Free/Pro and expiry boundary states |
| MEDIUM | usageStatus shape | P69 candidate returns a subset of legacy status fields (e.g. omits walletStartingCredits, period, subscriptionStatus, billing request fields) | **UNRESOLVED** — preserve client contract or version API |
| MEDIUM | Linked request ID | Candidate validates duplicateRequest ID before writing; original code accepts a wider Firestore doc ID space | **UNRESOLVED/NEEDS DESIGN** — strictness may break old data |
| HIGH | Exact source equivalence | P70 credit callbacks are rewritten, not derived byte-for-byte from source handlers | **UNRESOLVED** — target broader differential data and concurrency parity |
| CRITICAL | App Check | Source declaration and Emulator negative responses do not prove deployed backend enforcement | **NOT_PROVEN** |
| HIGH | Authorization race | P70 rechecks lease in each Firestore mutation; disables/revocations in Firebase Auth may race after gate live-user read | **REVIEW_REQUIRED** |

## New targeted emulator regression

- Duplicate barcode override uses approved request; approval AND linked request
  become consumed, with `consumedBy` matching the new recording.
- Replaying the same operation does not re-debit credits.
- Failing override finalization restores the previous completed lock and
  refunds exactly once.
- Pro unlimited plan leaves credit wallet balance unchanged.

Existing P70 concurrent wallet, idempotency, expiry, failure refund and stale
recovery tests are also run in P71 CI. No real customer data is used.

## Deployment / release status

No production files were modified. No Staging or Production cloud writes,
no merge or deployment. P63 Staging `recordingStatus` and `usageStatus`
guard drift remains unresolved. Backend App Check remains unproven.
The P70 deployment manifest retains `deployAllowed:false`.

**P71 may pass its *detection and regression CI* while semantic parity remains
REVIEW_REQUIRED. This is intended: a green CI is not a release approval.**

## Next review acceptance conditions

1. Resolve (or intentionally version and document) legacy provisioning and
   response-schema differences.
2. Add differential emulator tests for paid-plan expiry, legacy month roll,
   wallet month roll, Pro, malformed counters, unknown-plan credit preservation,
   duplicate approval consumption, and concurrent finalization/recovery.
3. Confirm P65/P70 live Auth/lease race policy and independent App Check runtime
   evidence before any approved isolated Staging rollout.
4. Obtain separate owner, operational, compliance and rollback approvals.
