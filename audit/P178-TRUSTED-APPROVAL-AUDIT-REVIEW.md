# P178 — Trusted Approval and Hash-Linked Audit Review

**Review only / NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**

## What is verified
- A pure offline Node.js Ed25519 verification candidate accepts exactly two separately signed, role-scoped evidence envelopes with a pinned trusted public-key registry. Signed scopes bind case ID, account ID, revision, requested owner UID, nonce and expiration.
- Signers must have distinct pinned actor IDs and key IDs. No caller-supplied keys are trusted. Arbitrary request assertions cannot grant approval.
- Valid signatures only yield **REVIEW_CANDIDATE**, always `authorizedToWrite:false`. No database access, claims update, Owner handler imports, Firebase SDK or production runtime authorization.
- A synthetic hash-linked audit ledger checks sequence, previous hash, event hash, uniqueness and detects mutations, deletion and reordering within a chain where its genesis is known.

## Explicit limitations
The test registry contains *ephemeral test keys generated during CI*, not real independently verified human identities, real approvals or production key management. An attacker able to replace the full audit log plus trusted anchor could rewrite the chain: a hash chain **does not ensure immutability** without external anchoring, protected storage and access control. The current audit ledger is entirely in-memory and **not atomically committed with Firestore transactions**. Nonces are scope-bound but no persistent replay registry has been implemented. A valid synthetic signature does NOT prove the human signer had authority. Do not treat any fixture result as migration permission.

## Follow-on requirements
P179: demo Firestore Emulator atomic account+audit writes with immutable external checkpoint proposal, concurrency and fail-closed error paths; independently managed approval keys, authenticated approver identity, key rotation/revocation, persistent nonce/case replay store and trust-root review. P172's eight release gates, P168 HTTP auth discrepancy, App Check, IAM, secrets, billing, monitoring, privacy/legal and signed production rollout approval remain outstanding.

## Run
```bash
node --check audit/p178-trusted-approval-audit.js
node audit/p178-trusted-approval-fixtures.js
```
Offline fixtures only. CI green is not a production deployment or identity attestation.
