# PACKTOOK Fast Track — Gate B Backend Policy Inventory & Acceptance Criteria

**2026-11-27 — source review only; no approval to deploy or exercise live callables.**

## Source observations

From `functions/index.js`, source starts with:
- `options={region,maxInstances:20,timeoutSeconds:30}`; no explicit App Check enforce flag in this base object
- `statusOptions={...options,enforceAppCheck:true}`
- `usageStatus` and `recordingStatus` are declared with `onCall(statusOptions,...)`
- `reserveCredit`, `finalizeCredit`, device-related and most account callables are declared with `onCall(options,...)`
- payment-related callables use other option expressions such as `paymentSecrets`; owner analytics use `ownerOptions`. The exact effective policies require examining these definitions and deployed configuration. Payment webhook is an HTTP handler and must have a separate webhook verification model.

This confirms **heterogeneous backend App Check settings in source**, not necessarily a vulnerability or a live-deployment discrepancy. It must be reviewed as an explicit threat-model decision before Full Public.

## Read-only inventory tool

`gate-b-backend-policy-inventory.py` enumerates named exported handlers, compares critical handler wrappers to known expected source, and prints counts/handler names with policy classifications. It makes **zero network, Auth, Firestore, Functions or payment calls** and does not auto-edit source or grant a PASS.

Run:
```bash
cd ~/packtook-p23173 || exit 1
git pull --ff-only origin review/p231-appcheck-runtime-readiness
python3 -B audit/fast-track-full-public/gate-b-backend-policy-inventory.py
echo "PACKTOOK_GATE_B_POLICY_INVENTORY_EXIT=$?"
```

## Gate B one-window execution matrix (requires separate scoped staging authorization)

| Gate | Evidence required | Block condition |
|---|---|---|
| B1 Auth/signup | verified/unverified Auth, signup-closed negative tests, email rate limits | Unverified identity can access protected data or signup-closed bypass |
| B2 App Check | real candidate on registered staging origin; request-correlated valid/missing/invalid tokens per relevant callable, including reservations/payment | Unprotected high-risk endpoint without reviewed compensating controls |
| B3 tenancy | synthetic cross-account deny for Firestore and all critical callables; role escalation deny | Cross-account read/write possible |
| B4 video/credits | one-device; reserve/finalize double-request; stale reservation; recovery after interrupted writes; Free 20 quota | Double-charge/loss/unauthorized override |
| B5 Omise | Test Mode sandbox: create/confirm/webhook signature/replay and reconciliation; fix historical provider HTTP 404 | Paid plan activated on unverified charge |
| B6 resilience | intermittent browser/network failures, concurrency, retry, idempotency, logs, recovery | Unrecoverable or silent data/credit integrity failure |

No real test begins under the current planning authorization; exact staging operations, origin, test accounts, scopes, limits and cancellation procedure must be approved separately. No production deploy or public signup enablement.
