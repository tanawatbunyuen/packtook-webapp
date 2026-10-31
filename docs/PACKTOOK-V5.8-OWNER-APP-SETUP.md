# PACKTOOK V5.8 — Standalone Owner Analytics Web App

**Status:** code committed to Firebase staging branch `feature/firebase-auth-credits-v4`, NOT YET deployed or tested on a live Firebase site. Customer PACKTOOK Hosting config `firebase.json` was left unchanged.

## Architecture

| Component | Customer app | Owner app |
|---|---|---|
| Hosted separately | `packtook-staging.web.app` | `packtook-owner-staging.web.app` **only after that globally unique Hosting site is created** |
| Frontend files | `firebase-staging/` | `owner-dashboard/` |
| Hosting config | `firebase.json` | `firebase.owner.json` |
| Firebase project | `packtook-staging` | same staging project |
| Identity | Verified Firebase customer account | Verified Firebase user with an explicitly assigned `packtookPlatformOwner:true` **custom claim** |
| Backend | Existing credit, packing and payments | New read-only `ownerAnalyticsSummary` and `ownerAnalyticsCustomers` callables |

**A customer 'admin' account does NOT become a platform owner.** Any customer who discovers the Owner URL can load the public static login page but cannot fetch cross-account data without the separately assigned custom claim, enforced on Cloud Functions server.

## Security/provisioning checklist (one-time)

1. Firebase Console → **Authentication → Users**: find the account that YOU control and copy its **UID**. Ensure its email is verified. Never enter a password/secret into this document.
2. In Cloud Shell, check you're in the intended Firebase staging project, then set Application Default Credentials if needed. The following actions require sufficiently privileged Firebase Auth IAM permissions. **Grant/revoke only your own authorized UID.**
3. From repository root:

```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4

export GOOGLE_CLOUD_PROJECT=packtook-staging

cd functions
node scripts/manage-platform-owner.js grant FIREBASE_AUTH_UID_HERE
cd ..
```

The Admin SDK script merges existing custom claims instead of overwriting other claims. On the owner's next login, token refresh (or sign out/in), the claim is effective. **Never put this claim in browser code, Firestore client data, a plain email allowlist or a public web config.**

To revoke access:

```bash
cd ~/packtook-webapp/functions
export GOOGLE_CLOUD_PROJECT=packtook-staging
node scripts/manage-platform-owner.js revoke FIREBASE_AUTH_UID_HERE
```

If Cloud Shell cannot use ADC, investigate the IAM/application-default credentials there; do **not** upload Firebase service account secrets to GitHub or Hosting.

## Create independent Hosting site (one-time)

The site ID `packtook-owner-staging` is a suggestion and must be **available globally**. If taken, choose a different valid site ID and use the same ID consistently in the next commands.

```bash
cd ~/packtook-webapp

firebase hosting:sites:create packtook-owner-staging --project packtook-staging
firebase target:apply hosting owner packtook-owner-staging --project packtook-staging
```

`firebase target:apply` records the mapping in local `.firebaserc`. This lets you deploy the Owner website without publishing any customer-site files.

## Deploy only new Owner Functions

```bash
firebase deploy --only functions:ownerAnalyticsSummary,functions:ownerAnalyticsCustomers --project packtook-staging
```

If multiple Functions encounter IAM/invoker/Cloud Run update errors, deploy one at a time and read the detailed deploy logs. **Do not relax invoker permissions to work around authorization errors.** The Functions themselves enforce platform-owner claims and are read-only.

## Deploy Owner website only

```bash
firebase deploy --config firebase.owner.json --only hosting:owner --project packtook-staging
```

After successful creation/deploy: `https://packtook-owner-staging.web.app/` if that exact site ID was used. This is a **proposed address, not confirmed active** until the CLI succeeds.

To deploy customer PACKTOOK as before:

```bash
firebase deploy --only hosting --project packtook-staging
```

The default `firebase.json` stays untouched and customer deployments will continue to target the original Hosting site.

## Dashboard metrics

- Total customer accounts, Free accounts, currently active paid subscriptions, expired paid subscriptions.
- Verified Omise **Test** completed invoice count and amount from account billingRequests marked `paid`, `paymentProvider:omise` with a Test charge ID.
- Strictly separate **live verified** paid amount. At present the Omise integration accepts **Test Mode only**; zero live revenue is expected.
- Unclassified legacy payment records are excluded from both verified Test and Live revenue, with a visible warning.
- 12 months of new account registrations and test payments (Asia/Bangkok month boundary), client 6/12 month selector.
- Current-plan distribution and sales by purchased plan.
- Read-only customer account listing, 25 per page; authorized owner now sees **Firebase Authentication Email, UID, plan, status, spendable video credits, reserved credits, creation date and expiry**. No passwords or billing secrets are exposed. The account directory email lookup occurs only in server-side Admin SDK after validating the Platform Owner custom claim.
- Credit display follows the same `creditAvailable(account)` wallet/legacy quota calculation used by PACKTOOK. Active Pro is shown as unlimited, expired paid plans show 0 *usable* credits, and inconsistent quota data is marked as needing review, rather than silently displayed as 0. Reserved video credits are shown separately. Free plans have no paid expiry date.
- Customer and payment data come from Firestore payment snapshots. This MVP is **not** a real-time Omise refunds/chargebacks reconciliation or accounting ledger.

**Scaling guard:** summary scans at most 1,200 customer accounts per refresh and marks `truncated=true` if there are more. In that case totals are incomplete; plan a server-side aggregation/scheduled rollup before larger production traffic. Every refresh performs Firestore reads and may incur cost. Do not repeatedly refresh unnecessarily.

## Acceptance tests

1. Owner site URL loads separately from customer PACKTOOK and the customer Packing page stays unchanged.
2. Unauthenticated visitor sees only a login screen; cannot fetch analytics.
3. Ordinary customer Admin, without `packtookPlatformOwner:true`, gets `permission-denied` from both callables even if directly invoked.
4. Owner sign-in shows real customer counts, active/expired/free data from **staging**.
5. All test charge amounts are labeled **not real revenue**; no test purchases appear under real-revenue KPI.
6. Transactions without verifiable Test/Live mode appear in the unclassified notice, not paid totals.
7. Monthly charts show signups and test receipts; per-plan sales and active/expired counts appear.
8. Customer table loads the next 25 records without data duplication and shows each authorized customer’s Email, video credit balance, reserved credits and expiry. Verify Free monthly remaining, paid wallet carryover, expired paid=0 usable, Pro=unlimited and missing Auth email display.
9. Confirm Owner app refresh/logout and access removal after a token refresh works.
10. Existing customer PACKTOOK Payments, Packing and Users remain unchanged; no cross-account data leak via customer client.
11. More than 1,200 accounts: summary warns it is partial; never display an incomplete total as comprehensive.

## Backlog after V5.8

- Schedule preaggregated daily/monthly rollups to avoid O(accounts + billing requests) full scans.
- Add verified live-payment reconciliation/refunds only when Omise Live Mode is deliberately enabled.
- Add retention/access logs, owner-role review and optional MFA enforcement at the account/IdP level.

