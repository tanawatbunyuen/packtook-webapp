# P165 — Backend Authorization & Tenant Isolation Static Review

## What was reviewed
Root `functions/index.js` Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3` and `firestore.rules` Git blob `d3e43720eb079c7f0fec50ec7f4e622fd7316e4a`. This audit checks source only and **does not import or invoke Functions, access Firebase Cloud, run data migrations, or deploy.**

## Key findings / distinctions

- **Client Firestore Rules do not constrain Admin SDK calls.** Source uses `admin.firestore()`; all backend entry points that reach Admin SDK require separate authorization review.
- Customer `accountRole` computes `role` but unconditionally returns `{role:"admin",accountId:id,canApproveDuplicates:true,multiUserEnabled:false}`. This is a self-account administrator model, not sufficient for employee roles or platform-owner permissions. Avoid promoting that value into a platform owner privilege.
- `accountIdFor(uidValue){return uidValue}` makes `assertAdmin`'s account ID vs UID comparison insufficient as an independent privilege check. Do not interpret this helper as a platform-Owner authorization guard.
- `authorizeDuplicate` explicitly states single Firebase user per account, and checks ownerUid against that same user. Accept only as a single-user approval model pending business policy review.
- `requirePlatformOwner(req)` checks `uid(req)` (authentication and verified email) plus `req.auth.token.packtookPlatformOwner===true`. The reviewed `ownerAnalyticsSummary` and `ownerAnalyticsCustomers` begin with `requirePlatformOwner(req)`. Static evidence is positive for these two handlers **only**. The four recovered missing Owner functions are NOT in the reviewed source; neither their identity checks nor their authorization ordering is attested.
- `omisePaymentWebhook` is public and relies on timestamp, signature and provider charge verification; requires additional isolated negative tests. Payment/Omise functionality was not executed.
- There are global `db.collection("accounts")` queries in Owner analytics; correct platform claim protection must also be confirmed in real runtime, including signed-out, non-owner, tampered claim, and valid Owner test identities. This audit does not assign any real custom claims.
- `firestore.rules` root source still lacks the semicolon added to the separately tested P163/P164 normalized candidate. Repository vs deployed Cloud Rules provenance **unverified**.

## Limitations

The scanner slices JavaScript handler text at exported `onCall/onRequest` boundaries. It checks **lexical evidence**, not control-flow or taint analysis. It cannot certify runtime ordering, payment security, data isolation of every Admin SDK write, MFA, App Check enforcement across handlers, least-privilege IAM, or recovery source provenance. P160–P164 passing in isolated demo **does not certify** Backend Owner Functions or production.

## Local read-only review

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p165-backend-authorization-static-audit
if [ ! -d "$HOME/packtook-p165" ]; then
  git worktree add --detach "$HOME/packtook-p165" origin/review/p165-backend-authorization-static-audit
fi
cd "$HOME/packtook-p165"
python3 audit/p165-backend-auth-audit.py
```

Expected `P165_STATIC_ASSESSMENT_COMPLETED`, specific evidence labels, and `P165_DECISION=NO_GO_BACKEND_AUTH_REVIEW_REQUIRED`. A successful script exit means only **the review executed**, not security approval.

## Remediation order

1. Explicitly define customer-admin vs tenant operator vs **platform owner** roles, and document `accountRole`/duplicate approval limitations before changing backend code.
2. Owner-callable design review: explicit claim validation, verify authentication before all reads/writes, object-level authorization, App Check, idempotency and audit logs. Do not import recovered source yet.
3. Build independent in-memory / demo emulator negative fixtures for signed-out, non-Owner, forged request data, cross-tenant account IDs, and legitimate Owner claims. Do not provision real claim or hit cloud.
4. Separate read-only deployed-rules provenance check only after security permissions and operator approval.
5. Review Omise webhook and payment reconciliation separately with TEST fixtures; never mix payments into owner security readiness.
6. Keep `NO_GO_OWNER_IMPORT` and `NO_GO_DEPLOY` pending full security and operational sign-offs.
