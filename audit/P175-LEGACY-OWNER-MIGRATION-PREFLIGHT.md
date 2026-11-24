# P175 — Legacy Owner UID Migration Read-Only Preflight

**Decision: NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY. No production handler modification, user data access, admin role or account migration.**

## Objective
P174's persisted-ownerUid authorization guard correctly fails closed for old customer records lacking ownerUid, but switching it on directly would lock out otherwise legitimate customers. P175 creates a completely offline *review proposal*, not an automatic migration or proof of entitlement.

## Preconditions for any future migration
1. Existing ownerUid is immutable here: same account ID yields NO_CHANGE; any differing ownerUid is BLOCK (never overwrite).
2. The independently verified identity must exist, be enabled, email verified and equal the historically used single-user account document ID. Client-supplied role/owner fields count as no evidence.
3. A trusted operator must separately verify the account was originally created using the legacy one-account-one-Firebase-UID scheme and review account provenance. If provenance cannot be established, MANUAL_REVIEW.
4. A case ticket and both security reviewer and authenticated account-owner approvals must be supported by verifiable, separate external records. Boolean assertions passed to this *offline preview* are **not actual proof**.
5. Conflicting or unknown ownership status BLOCKS.
6. A positive preview only proposes `ownerUid = authUid` for human review; `authorizedToWrite:false`, `previewOnly:true`. It does not generate database writes, implement transactions, change claims, contact Firebase, or delegate privileges.

## Candidate architecture for later separately approved implementation
Use a narrowly scoped backfill service account, allowlisted synthetic/test accounts first, independent external evidence retrieval, explicit case tracking, re-read Firestore document in a transaction, reject changed revision/ownerUid, append immutable audit with actor and reference ticket, and verify behavior through Auth/Firestore emulator plus backup/rollback runbook. Never trust request data as approval. Do not use Admin SDK to bypass policy without a reviewed source-level owner check. Do not enable any owner import or production deploy without written Owner approval.

## Source provenance
Original `functions/index.js` Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3`; remains unchanged. P174 guard and P173 root Firestore Rules candidate remain separate review artifacts. The 20 offline synthetic cases cover conflicts, missing evidence, disabled/unverified users, forged client inputs, two-approval requirement and idempotent existing owner behavior. They cannot verify the truth of external attestations or production data.

## Cloud Shell (local static only)
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p175-legacy-owner-migration-preflight
if [ ! -d "$HOME/packtook-p175" ]; then
  git worktree add --detach "$HOME/packtook-p175" origin/review/p175-legacy-owner-migration-preflight
fi
cd "$HOME/packtook-p175"
node audit/p175-owner-migration-fixtures.js
node audit/p174-authz-offline-fixtures.js
node audit/p173-root-rules-fixtures.js
node audit/p172-release-fixtures.js
node audit/p172-release-gates.js
```

## Next gates
Actual trusted Owner selection policy; independent evidence source and approver verification; full Firestore transaction and audit candidate in **demo emulator only**; migration dry run for true inventory (requires separate authorization); account role and duplicate approval runtime negative tests; backend payment and broad query review; App Check, IAM, secret, billing, monitoring, PDPA and sign-off remain pending.
