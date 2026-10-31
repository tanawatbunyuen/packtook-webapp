# PACKTOOK Owner V5.9 — Google Cloud Shell Staging Patch

## 0. Special case: Customer App Cloud Shell (firebase.json codebase default)

If `find ~ -name firebase.json` returns only `~/packtook-webapp/firebase.json`, and `firebase.json` defines `functions: [{source:"functions",codebase:"default"}]` plus customer Hosting (`firebase-staging`), **do not use `install-cloudshell.sh`** (that version requires a separate Owner Hosting root). Instead, from `~/packtook-webapp` run:

```sh
PATCH_DIR="$(mktemp -d)"
git clone --depth 1 --branch feature/owner-v5.9-management https://github.com/tanawatbunyuen/packtook-webapp.git "$PATCH_DIR"
bash "$PATCH_DIR/owner-v5.9/install-backend-cloudshell.sh"
```

This installs **only the backend** into the existing Firebase project's `functions/` entrypoint. It backs up files, requires explicit Firestore field mappings, and does not deploy. The Owner frontend remains separate and still requires its original source code to add the Manage button. Do not run `firebase deploy --only hosting` from this customer Hosting root; that would target the customer site, not `packtook-owner-staging`.



**Goal:** Add manual video-credit grants and subscription expiry edits to the EXISTING [Owner Staging](https://packtook-owner-staging.web.app/#customers). This directory is a patch, **not a complete replacement** for Owner Dashboard V5.8.

## 1. Copy into Cloud Shell

First, open Google Cloud Shell and `cd` to the EXISTING owner application's Firebase directory containing `firebase.json`. If the source code is elsewhere, locate it first:

```sh
find ~ -name firebase.json -not -path '*/node_modules/*' -print
```

Then, while inside your **Owner source directory**, copy-paste:

```sh
PATCH_DIR="$(mktemp -d)"
git clone --depth 1 --branch feature/owner-v5.9-management https://github.com/tanawatbunyuen/packtook-webapp.git "$PATCH_DIR"
bash "$PATCH_DIR/owner-v5.9/install-cloudshell.sh"
```

Installer: verifies `firebase.json`, existing Cloud Functions and Owner Hosting, backs up files, prompts for the TRUE Firestore schema mappings, copies new files, and prints deployment commands. It **never deploys automatically**. It leaves other existing functions and the owner analytics app intact.

## 2. Map actual Firestore schema before enabling mutation

Read the live code for `finalizeCredit`, the credit reservation logic, `ownerAnalyticsCustomers`, customer entitlement check, and Omise webhook. Identify exact:
- Credits document path, with `{uid}` placeholder
- Remaining credits field (integer; **not reserved** or lifetime total)
- Customer expiry document path and field
- Plan document path and plan field
- Expiry field type: `timestamp`, `iso`, or `milliseconds`

**Never guess from this example:** `wallets/{uid}`, `remaining`, `users/{uid}`, `subscription.expiresAt`. The real PACKTOOK schema may be different.

The current Owner's Firebase Auth token must contain `packtookPlatformOwner: true`. This is checked SERVER-SIDE and cannot be granted by this frontend.

## 3. Integrate Manage button into existing Customers renderer

The installer loads `/owner-management-v59.js` into the existing Owner HTML. However, you must insert one Manage button per customer in your **existing V5.8 customers list rendering code**. Adapt `customer.uid` and `customer.email` to the real data shape:

```js
// Reuse Firebase modular app and imports already used in your Owner V5.8 source:
//   import {getFunctions,httpsCallable} from "firebase/functions";
const functions = getFunctions(app, "asia-southeast1");
const ownerCall = async (name,data) =>
  (await httpsCallable(functions,name)(data)).data;

const manageBtn = document.createElement('button');
manageBtn.type = 'button';
manageBtn.textContent = 'Manage';
manageBtn.onclick = () => window.PACKTOOK_OWNER_V59.openCustomerManager({
  customerUid: customer.uid,   // ACTUAL Firebase Auth UID — not email or Firestore row id
  email: customer.email || '',
  call: ownerCall,
  onSaved: reloadCustomers     // existing V5.8 refresh function
});
actionCell.append(manageBtn);
```

If V5.8 uses Firebase **compat** SDK instead of modular:

```js
const ownerCall = async (name,data) =>
  (await firebase.app().functions('asia-southeast1').httpsCallable(name)(data)).data;
```

The `firebase.app()` must be the same authenticated Owner app; do not initialize a separate app. The `actionCell` and `reloadCustomers` names in snippets are placeholders from your real table renderer.

After changing a **source** front end (Vite/React/other), run its existing build command and ensure the JS patch is still in the Hosting `public` output directory **after** building. If the build regenerates index.html, put the module tag in the source HTML and copy the patch into the source public/assets directory. No attempt is made to guess the build tool.

## 4. Deploy staging ONLY

From your existing Firebase root:

```sh
firebase deploy --project packtook-staging --only functions:ownerGetCustomerManageState,functions:ownerGrantVideoCredits,functions:ownerUpdateCustomerExpiry,functions:ownerGetCustomerAdjustmentHistory
```

Once the **existing customers renderer is integrated and built**, deploy Owner Hosting only:

```sh
firebase deploy --project packtook-staging --only hosting:owner
```

`hosting:owner` works when your Firebase CLI target is named `owner`. Otherwise inspect `firebase.json`/`.firebaserc` and choose the actual Owner-only target. **Do not use unrestricted `firebase deploy`** — that could modify other functions/sites/rules.

## 5. Smoke test with one TEST account

1. Owner login works, customer email is unchanged and Manage opens.
2. Add 5 credits with explanation at least 10 characters; remaining increases by 5 and reserved is unchanged. Reload customer packing app to confirm.
3. Same requestId replay does not double-charge or double-grant (idempotency).
4. Set expiry date to 2026-12-31; exclusive cutoff becomes 2027-01-01 00:00 Bangkok (2026-12-31 17:00 UTC).
5. Refresh both Owner and Customer apps; package/expiry must match.
6. Non-owner must fail with `permission-denied`.
7. Verify `ownerCustomerActions/{requestId}` and `ownerCustomerActionsByUser/{uid}/events/{requestId}` are created as audit logs.
8. Verify that payment webhook / renewal doesn't overwrite manual adjustments and Pro unlimited credits remain untouched.

## Security and rollback

- Both mutation APIs require Firebase Auth custom claim `packtookPlatformOwner === true`, valid UUID, amount/date validation, reason (10–300 chars), server transaction, and audit log.
- No direct Firestore writes are made by browser; don't add browser-side rules allowing these writes.
- Idempotency assumes a unique new UUID per intentional operation. Retrying a failed/network-timeout request must reuse the same UUID.
- If there is a failure, stop; use `.packtook-v59-backup-YYYYmmdd-HHMMSS/` in your Owner project for the original function entry, env, and HTML. Do not automatically roll back a successful credit adjustment by deleting audit history.
- Test on staging before any Production implementation. **No production deployment is included.**
