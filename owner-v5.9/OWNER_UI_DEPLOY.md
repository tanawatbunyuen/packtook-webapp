# PACKTOOK V5.9 — Owner Customer Management UI (Staging)

**Source base:** `feature/firebase-auth-credits-v4` (contains the real V5.8 `owner-dashboard/`, `firebase.owner.json` and Owner Firebase Auth integration). This patch does not replace the customer web app and does not deploy any functions.

## Cloud Shell — copy/paste

From the current `~/packtook-webapp` directory (which already has the customer Functions and Owner app source):

```sh
cd ~/packtook-webapp
PATCH_DIR="$(mktemp -d)"
git clone --depth 1 --branch feature/owner-v5.9-ui \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$PATCH_DIR"
bash "$PATCH_DIR/owner-v5.9/install-owner-ui-cloudshell.sh"
```

Installer prerequisites and safety:
- Performs a **read-only comparison** of your local `owner-dashboard/app.js`, `index.html`, `style.css` with committed V5.8 files.
- If files differ, **stops**, preserving your local changes. It won't silently overwrite a customized Owner Dashboard.
- Backs up Owner source in `.packtook-owner-v59-backup-YYYYmmdd-HHMMSS` before changing it.
- Only copies Owner UI files and (when missing) `firebase.owner.json`. **Never touches** `functions/`, `firebase.json`, `firebase-staging/`, or the customer PACKING app.
- Stops if firebase.owner.json has a different Hosting target.
- Does **not deploy** automatically.

After the installer succeeds, verify the existing Firebase target mapping and deploy ONLY the Owner site:

```sh
firebase target:apply hosting owner packtook-owner-staging --project packtook-staging
firebase deploy --config firebase.owner.json --only hosting:owner --project packtook-staging
```

The target command is only necessary if the mapping hasn't previously been configured; normally the existing `.firebaserc` already contains it.

## How it works

The customer renderer already provides `a.accountId`, `a.email`, subscription state, credits, and expiry. The patch adds one ninth `จัดการ` column (including empty-table colspan updates) and imports the V5.9 dialog.

It uses the existing Owner Firebase app, regional callable factory and Auth session to invoke:
- `ownerGetCustomerManageState`
- `ownerGrantVideoCredits`
- `ownerUpdateCustomerExpiry`
- `ownerGetCustomerAdjustmentHistory`

The modal refreshes both customer listing and summary after successful mutations. All writes are server-side; no Firestore client writes.

### Important backend requirements

The four callable functions must already exist in `packtook-staging` (`asia-southeast1`). The Owner Auth token must include `packtookPlatformOwner: true`. Backend field mapping is `accounts/{uid}` / `creditWalletRemaining` / `planExpiresAt` / `plan`, expiry type ISO string.

Existing credit grant backend refuses non-wallet (`creditWalletV1!==true`) and unlimited Pro accounts. Billing requests in progress block both credit and expiry mutation. Free plans without a configured expiry cannot be manually extended from the UI: the UI disables expiry editing for accounts with no expiry.

## Acceptance checks

1. Load `https://packtook-owner-staging.web.app/#customers`, sign in as Owner, and verify ninth 'จัดการ' column.
2. Click Manage on an existing **wallet-enabled non-Pro TEST customer**. Check Email/UID, credit balance, and expiry.
3. Add **one test credit** with a 10+ character reason, confirm, and verify Owner and Customer app credit balances change once, while reserved credits are unchanged.
4. Set an expiry date; verify Owner and Customer app show the same effective expiry and timezone boundary.
5. Verify audit history in modal. Repeat failed/network-timeout action with same request ID; no duplicate credit should be added.
6. Verify Pro/legacy non-wallet plan credits cannot be adjusted, and ordinary customer accounts cannot call Owner Functions.
7. Verify Overview, Plans, charts, customer pagination and Customer Packing remain unchanged.

**Current scope:** Staging only, not Production. Omise webhook/payment race conditions should be exercised before allowing operational customer adjustments.
