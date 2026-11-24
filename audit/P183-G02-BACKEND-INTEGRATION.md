# P183 — G02 Integrated Full Backend Candidate / Legacy Safety

**Review-only: NO_GO_RELEASE, NO_GO_DEPLOY, NO_GO_OWNER_IMPORT, public signup CLOSED.**

## What is integrated
P183 builds the *entire* 670-line, SHA-pinned source `functions/index.js` into an isolated **generated copy** under `audit/p183/.generated-index.js`. The builder checks original Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3` and applies exactly four guarded changes:
1. `assertAdmin` checks persisted ownerUid rather than self-equality.
2. `authorizeDuplicate` uses a read-only account reference (does not create a missing account).
3. Duplicate approval requires `account.ownerUid===authenticatedUid` and removes silent legacy owner bootstrap.
4. `accountRole` requires persisted ownerUid rather than always returning admin.

The original `functions/index.js` remains byte-for-byte unchanged so P172/P174 historical source pins and release block gates remain authoritative. This is a genuine **full source candidate** executed in isolation against the real Firestore Emulator. The test loads all handler exports but injects a **stub onCall transport**, mocked Firebase Functions parameters and synthetic request auth contexts. Thus it verifies real handler + real datastore transactions, **NOT** Firebase Auth token signature, App Check, Cloud Functions/Callable HTTP transport, or production IAM.

## Legacy-account decision
Existing accounts missing ownerUid remain able to call unaffected status/recording endpoints, but **accountRole and authorizeDuplicate are deliberately denied**. This is a user-facing regression until a read-only inventory, independent provenance checks, explicit migration plan, backup/rollback review, and genuine owner authorization are completed. Do NOT deploy this candidate or silently backfill ownerUid. No real account inventory is performed in this PR.

## Remaining G02 critical path
1. Read-only, authorized legacy account inventory and independent owner identity provenance.
2. Design and review verified/manual remediation for affected accounts; audit and rollback.
3. Auth+Functions+Firestore emulator HTTP integration on actual candidate exports, negative signed-out/malformed tokens, unverified/other owner; account status compatibility and no fake Owner grants.
4. Security reviewer approval with release candidate pin. G02 remains NO_GO until all evidence is complete.

## CI
Generate integrated candidate in disposable runner and invoke real handlers with synthetic identities. This is intentionally distinct from P182's disconnected candidate and does not import any recovered Owner functions. No product functions, hosting, rules, Customer or Production data written.
