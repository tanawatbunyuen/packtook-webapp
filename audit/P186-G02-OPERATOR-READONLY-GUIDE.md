# P186 — G02 Authorized Read-only Operator Evidence Preflight

**NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY / PUBLIC_SIGNUP_CLOSED.**

## Added
- `audit/p186-g02-operator-cli.js` is a human-invoked, separately gated **read-only** Firestore + Firebase Auth inventory adapter for P185. It uses account document ID ordering, paginated bounded reads, `getUser` for missing-owner records, aggregate-only stdout, and removes the UID-derived fingerprint from the output.
- `audit/p186-g02-operator-gate.js` refuses unlisted projects, GitHub CI, live-plus-emulator environments, missing exact operator project/ticket and absent explicit read-only acknowledgement. The gate is a **safety preflight only**, not a cryptographic proof of approval; an authorized organization must independently verify the operator and change ticket.
- Gate fixtures are offline; GitHub Actions deliberately does **not** call production or staging.

## Operator instructions (not run in CI)
An independently authorized Cloud Operator, working in their own protected shell with least-privilege read permissions and approved ticket, may run after separate security approval:

```bash
# On an approved operator workstation, with node_modules installed from the reviewed manifest.
# NO service-account keys in repository, tickets, issue comments or CI.
export PACKTOOK_G02_OPERATOR_APPROVED_PROJECT=packtook-staging
export PACKTOOK_G02_OPERATOR_CHANGE_TICKET=G02-REVIEW-20261124
node audit/p186-g02-operator-cli.js --project=packtook-staging \
  --ack=I_AUTHORIZE_READ_ONLY_G02_INVENTORY --max-docs=1000 --page-size=50
```

The CLI deliberately needs `audit/p177-emulator/node_modules/firebase-admin`, installed through an approved reviewed dependency process. The CLI does not export account IDs or emails, but operator credentials could still access data; enforce org IAM and local command auditing. A return code 2 or `complete:false` means **incomplete scan**; increase bound (max 10000) or implement a separately reviewed continuation before relying on counts. Auth lookup errors must be separately resolved. A `G02-` ticket environment variable is a checklist requirement, **not** verification of the legitimacy of the ticket or a right to deploy.

## Required external evidence before G02 can pass
1. Operator-executed read-only **staging and production** inventory with no truncation, Auth lookup errors resolved, owner provenance assessment of conflicts and legacy accounts, evidence stored in protected review system.
2. Independent evidence and security reviewer decisions for ambiguous or missing ownerUid; audited, reversibly approved migration only if needed.
3. Real staging valid **App Check** positive path for usageStatus plus invalid/missing token denial. P184 verifies only missing-token denial; a fabricated token or Emulator bypass is unacceptable evidence.
4. Reviewed release source containing P183 persisted owner guards and P184 Firebase Admin FieldValue import fix, code ownership security signoff, real staging Auth/Functions/Firestore verification and no regressions.

## Security constraints
This change performs **zero live reads in CI** and no migrations, deployments, ownership grants or owner import. The previously verified P184 14/14 callable tests and P185 12/12 synthetic inventory tests remain useful but not substitutes for real inventory/App Check/human signoff. G02 remains NO_GO.
