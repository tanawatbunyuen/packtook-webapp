# P177 — Firestore Emulator Transaction Review

**REVIEW ONLY. NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**

This adds a synthetic Admin SDK transaction harness that runs **only** when FIRESTORE_EMULATOR_HOST is exactly localhost 127.0.0.1 and GCLOUD_PROJECT is exactly demo-packtook-p177. Firestore client rules are deny-all; Admin SDK emulator tests are not client rules tests. An isolated local Firestore Emulator is started by CI without importing `functions/index.js`, reading real customer data, or contacting production Firebase.

The ten test cases cover transaction commit, stale revision, existing owner, conflicting owner, cross-account mismatch, missing approval, disabled identity, nonexistent account, concurrent writers and replay. The fixture is **not** a migration tool; the synthetic approvals are not authenticated and must never be used to grant privileges.

Run in a disposable test environment with Node 22 + Java 21:
```bash
npm install --prefix audit/p177-emulator --ignore-scripts --no-audit --no-fund --no-package-lock
audit/p177-emulator/node_modules/.bin/firebase emulators:exec --project demo-packtook-p177 --only firestore --config audit/p177-emulator/firebase.json "node audit/p177-firestore-transaction-fixtures.js"
```
The CI runner can download emulator binaries; that is infrastructure setup, not a project deploy. It must never use production project IDs or authentication. If CI is missing, blocked or red, treat results as unverified.

### Remaining blockers
Independent trusted identity/approval verification; actual transaction-backed audited migration design with security review; account inventory and rollback; cross-service runtime negative tests; original P172 release gates, P168 callable HTTP discrepancy; backend, IAM, App Check, billing, monitoring, secrets and PDPA signoffs.
