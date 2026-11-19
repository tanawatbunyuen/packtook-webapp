# P117 — Firebase staging deployment readiness, evidence-first

Status: **NO_GO_STAGING**. This branch only creates an evidence gate; it must not deploy.

## Confirmed evidence
- P114 offline Node CI for P111 and P113 completed successfully.
- P116 read-only SHA-256 probe completed: 0/3 matched, 3/3 source drift; same-origin redirect handled.
- The P113 client configuration has a deliberately empty staging App Check site key.
- This candidate's `firebase.json` uses `functions.codebase=default`; no `.firebaserc` exists in the review source. Neither establishes safe deployment identity.
- Backend Functions revision, exact selector ownership, current staging IAM, actual App Check registration, browser E2E and monitoring/rollback are **unverified**.

## Operator conditions before any staging deployment
1. Retrieve staging Firebase App Check reCAPTCHA Enterprise *public site key* via authorized console. Confirm application ID and domain allowlist. Do not substitute a guessed key or production key.
2. Verify current Cloud Functions inventory, codebase metadata and deployed image/revision sources independently. Protect unrelated `default` functions and non-staging environments; never run an unscoped `firebase deploy`.
3. Freeze reviewed commit SHA, function selector names, CLI version, IAM identity, audit logs and rollback revision; reconcile 3/3 hosting drift.
4. Confirm staging-only test users, verified/unverified email combinations, missing/invalid/valid App Check tokens, cross-account resource denial and expected status payloads.
5. Record monitoring/rollback evidence and staging owner authorization. Keep public signup closed. Do not deploy production.

## Read-only gate
```bash
node --check audit/p117-staging-deploy-gate.cjs
node audit/p117-staging-deploy-gate.cjs
```

The workflow succeeds if the script correctly reports `P117_DECISION=NO_GO_STAGING`. This is a safe **gate verification**, not launch readiness.
