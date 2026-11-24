# P179 — Atomic Account + Audit Transaction Demo Emulator

**REVIEW ONLY: NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**

## What the test proves
Within a disposable localhost Firestore Emulator (project `demo-packtook-p179`), synthetic account owner UID and revision, unique case marker, and a hash-linked ledger document are staged in the *same* Firestore Admin SDK transaction. Ten regression cases cover success, replay, stale revision, invalid signature, throw before writes, throw after staging writes, concurrent conflicting writers, existing foreign owner, missing account and tampered audit record. Every test is confined to demo collections and ephemeral in-memory approval keys.

## What it does NOT prove
The demo-only helper does not authorize or execute migration on real accounts. No genuine identity/approval provenance or secure key lifecycle has been verified. The synthetic audit hash chain is stored in a mutable Firestore document and has no independently trusted external anchor, production-grade immutable store or retention policy. A single ledger array is not scalable: transaction size and contention require a redesigned audit architecture before real-world use. The P178 signature proof is validated **outside** the transaction, without a durable replay-key store or key revocation checks. Tests use Admin SDK, not Firestore client rules. Network-dependent emulator setup is CI infrastructure only.

## Fail-closed restrictions
The harness rejects every host outside `127.0.0.1:<port>` and project other than `demo-packtook-p179`. Production `functions/index.js` remains unchanged; no live Firebase operations, merge, deploy, claims or Owner handler imports.

## Reproduction (disposable machine)
```bash
npm install --prefix audit/p177-emulator --ignore-scripts --no-audit --no-fund --no-package-lock
GCLOUD_PROJECT=demo-packtook-p179 GOOGLE_CLOUD_PROJECT=demo-packtook-p179 audit/p177-emulator/node_modules/.bin/firebase emulators:exec --project demo-packtook-p179 --only firestore --config audit/p177-emulator/firebase.json "node audit/p179-atomic-migration-audit-emulator.js"
```

## Next security gates
Independent provenance, independently authenticated human approvals, secure key registry/rotation/revocation and approval evidence fetch, externally anchored immutable append-only audit, durable nonce/case dedup, production-scale architecture and backup/rollback; full IAM, App Check, monitoring, billing, secrets, PDPA and outstanding P172/P168 gates. Positive emulator fixture is NOT production approval.
