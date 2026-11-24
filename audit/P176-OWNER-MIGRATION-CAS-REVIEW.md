# P176 — Owner Migration Compare-and-Swap Offline Regression

**Status: REVIEW ONLY / NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**

## Purpose
Extend P175's offline migration preview by screening for stale snapshots, concurrent ownership/revision changes, cross-account preview swaps, and missing operator evidence. This is **not** a Firestore transaction implementation and is not usable as an authorization gate.

## Guard behavior
- Compares the original and latest account ID, persisted ownerUid and integer revision, and compares the P175 preview against the latest snapshot.
- Requires an independently verified operator evidence indicator in synthetic input; **that boolean is not itself independently authenticated**. Ticket strings are only formats, not evidence retrieval.
- Returns only CANDIDATE_ONLY / NO_CHANGE / REVIEW / BLOCK, always `authorizedToWrite:false`. No transaction, cloud access, database reads/writes, or SDK import.
- 15 synthetic cases include revision and ownership races, identity swaps, disabled users and missing approvals.

## Mandatory release blockers
1. Source-verified single-UID identity provenance and current legacy-account inventory (separate authorized read-only process).
2. Independently verified owner and security approvals from trusted records; prevention of self-approval.
3. Scoped Firestore transaction emulator design with server-side re-read, atomic preconditions, idempotency and audit; concurrency tests must actually run in the emulator.
4. Explicit rollback plan and partial-failure handling; no replacement of existing ownerUid.
5. Complete P172 security release gates, P168 callable HTTP protocol resolution, additional backend/claims review, IAM, App Check, Secret Manager, billing, monitoring, privacy/legal and written launch approval.

## Offline run
```bash
node audit/p176-owner-migration-cas-fixtures.js
node audit/p175-owner-migration-fixtures.js
node audit/p174-authz-offline-fixtures.js
node audit/p173-root-rules-fixtures.js
node audit/p172-release-gates.js
```
CI green means offline consistency only, never permission to migrate/merge/deploy.
