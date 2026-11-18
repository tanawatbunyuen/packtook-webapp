# PACKTOOK P84 — Deployment Scope & Rollback Safety Review

**OFFLINE/READ-ONLY — NOT A DEPLOYMENT AUTHORIZATION.**

## Evidence now established

The owner ran P83 against the real `packtook-staging` project and
reported five ACTIVE Gen 2 Functions with source generations, revisions
and runtime identities, stable across two reads. All five Functions had
**no recognizable codebase label**; at least two shared a runtime service
identity. P80 earlier showed **confirmed reviewed-source guard drift**
for `recordingStatus` and `usageStatus`.

Shared identity does NOT prove excessive access. Missing codebase labels
do NOT prove missing Firebase ownership. A source generation and revision
do NOT prove an available, functional rollback.

## What P84 adds

- `production/scripts/p84-deployment-scope-readonly.py` is an
  owner-run, opt-in metadata-only inspection. It reads all five
  Functions twice, classifies exactly two remediation targets and
  three excluded credit Functions, and compares in RAM whether a
  source object generation appears shared across target/excluded
  functions. No source IDs, principal names or sensitive metadata
  are printed. This comparison is not an assertion of the true
  Firebase CLI deploy codebase mapping.
- `production/ast-review/p84-deployment-scope-gate.cjs` locks P82/P83
  operator evidence to the actual observations and **always blocks
  deployment**, even if a source pin grouping looks segregated.
- Synthetic read-only cloud-response and evidence mutation tests.
  CI requires no Google Cloud credentials and never calls Cloud APIs.

## Operator-controlled Staging-only metadata inspection

Only from a fresh clone in a trusted Cloud Shell session when ready:

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p84-deployment-scope-rollback-safety \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
python3 "$WORKDIR/packtook/production/scripts/p84-deployment-scope-readonly.py" --inspect
```

This reads *metadata only* and produces no writes. No npm install is needed.

## Critical open gates before any authorized deployment

1. Independently determine which Firebase CLI codebase and deploy
   selector own each existing callable. Do not deploy or alter codebase
   labels solely based on source-pin equality.
2. Capture immutable revision/source generations and prove that the
   known-good prior binary can actually be **restored**; record an
   incident-tested rollback path privately.
3. Review the shared runtime principal's effective IAM bindings in a
   private, least-privilege security review (do not paste IAM members
   or service account emails publicly).
4. Verify backend App Check and Auth enforcement with real positive and
   negative tests, and confirm frontend/API semantic compatibility.
5. Preserve `reserveCredit`, `finalizeCredit` and
   `recoverStaleVideoReservation`, along with customer credit records.
6. Separate owner authorization is required for any Staging deploy.
   Production and Public Signup remain closed / NO_GO.

`P84_STAGING_DEPLOY=BLOCKED` and `RELEASE=NO_GO_RELEASE`.
