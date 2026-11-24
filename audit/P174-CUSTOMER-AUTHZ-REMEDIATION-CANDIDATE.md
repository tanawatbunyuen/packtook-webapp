# P174 — Customer Administrator Authorization Boundary (review-only)
**Current decision: NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY. No changes to functions/index.js.**

## Findings from exact original pinned source
- `accountRole` always returns `role:"admin"` with `canApproveDuplicates:true`, without a persisted `ownerUid` check. This appears intended for a one-user-per-account system, not yet a supported multi-user role model.
- `authorizeDuplicate` uses account ID == authenticated UID and, when `ownerUid` is missing, writes `ownerUid = accountId`. This is a first-owner bootstrap behavior, which must not be treated as a full multi-user authorization proof.
- `assertAdmin(uidValue)` compares an accountId that currently resolves to the same UID; a textual scan shows no calls to this function, so it is a dormant authorization helper, not evidence of a directly reachable escalation endpoint.
- Two existing platform Owner Analytics endpoints use separate `packtookPlatformOwner===true` verification. Do not conflate this platform role with customer account administrator.

## Safe candidate
`audit/p174-authz-guard-candidate.js` requires a signed-in, email-verified Firebase request UID and an **already-persisted** matching `ownerUid` before allowing account administrator and duplicate approval operations. Missing legacy `ownerUid` fails closed. `audit/p174-authz-offline-fixtures.js` executes 12 synthetic mock cases, including client role forgery attempts, cross-account access denial, absent owner, and verified owner success.

**Important tradeoff:** existing accounts with no `ownerUid` would be locked out of owner-only operations if this candidate were directly installed. A separately reviewed and authorized, auditable one-time bootstrap/migration policy is required **before** touching live handlers. Do not auto-assign owners from untrusted request bodies and do not silently alter production enrollment semantics.

This is a behavioral design candidate, not a merged patch, IAM role change, real Firestore test, or production authorization attestation. No recovered Owner functions were imported.

## Cloud Shell
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p174-customer-admin-authz-boundary
if [ ! -d "$HOME/packtook-p174" ]; then
  git worktree add --detach "$HOME/packtook-p174" origin/review/p174-customer-admin-authz-boundary
fi
cd "$HOME/packtook-p174"
node audit/p174-authz-offline-fixtures.js
node audit/p173-root-rules-fixtures.js
node audit/p172-release-fixtures.js
node audit/p172-release-gates.js
```

## Open work before go
A. Explicitly approve whether customer accounts are permanently single-user or should support owner/operator delegation.
B. Define and test trusted ownerUid enrollment/migration for legacy accounts without ownerUid.
C. Extend with full-source handler and local callable/Auth/Firestore emulator tests, including authorization before datastore reads/writes and tenant separation; don't replace P168 strict invalid-token expectations.
D. Review payment webhooks, broad queries, App Check, IAM, Secret Manager, billing/monitoring/privacy and Owner release authority.
E. Establish deployed revision/rules verification under separately authorized, controlled release plan.

Passing CI means *only* that this isolated candidate's mock fixtures pass.
