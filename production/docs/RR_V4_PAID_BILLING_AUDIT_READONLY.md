# PACKTOOK V4 Paid Billing — Read-only credit and audit trail verification

Latest verified operator outcome: Omise Test API verified paid Business charge THB 1290; billing request in `packtook-staging` is **already paid**. `openBillingRequestId` mismatch is expected after successful settlement: the handler removes the lock in the transaction. Do **not** recreate the lock or reconcile/settle the same paid charge just to observe it.

## Actual payment handler behavior
`functions/index.js` writes the paid ticket fields `creditsPurchased`, `transferredCredits`, `balanceAfter`, `paymentProvider`, `activationExpiresAt`, increments `billingVersion`, stores `creditWalletRemaining` in the account and inserts `accounts/{uid}/audit/{autoId}` with action `subscription_credits_merged`. The account's current wallet may be lower than `balanceAfter` after recordings consume credits, or plan may have subsequently changed. Therefore **do not assume current balance must equal original grant**, and treat changed plan as needing timeline review rather than immediate billing corruption.

## Operator-safe audit
From reviewed standalone worktree:
```bash
gcloud config set project packtook-staging
export RR_STAGING_PROJECT_ID=packtook-staging
python3 production/scripts/rr-v4-paid-billing-credit-audit-readonly.py
```

Read-only GET Omise Test charge + two Staging Firestore docs and `audit` collection pages (max 500 records). Compares provider charge, paid ticket, amount and credits, and exactly **one** `subscription_credits_merged` matching the ticket/request and charge, with matching credit quantities. Checks present-day account wallet flag and nonnegative balance, with no forced equality to original grant. If audit history spans >500 records output is `AUDIT_LIST_INCOMPLETE` and **no pass**. No UID, request IDs, raw document or secret printed. No Firestore writes, no job execution, no deploy.

`V4_PAID_BILLING_AUDIT: PAID_GRANT_AUDIT_ONE_MATCH_CURRENT_PLAN` means this specific receipt has one matching recorded credit grant and the **current** account is Business with a plausible nonnegative wallet. It does not prove conservation of credits across all historical recordings or guarantee the Staging project payment backend is deployed on the same commit; compare ledger to recording events separately if full accounting is needed. If an audit is missing, duplicated, inconsistent, plan changed, or history incomplete, preserve the data and escalate for review, never correct automatically.

**NO_GO_RELEASE / PUBLIC CLOSED.**
