# PACKTOOK P83 — Staging Identity, Codebase & Rollback Evidence

## Outcome

P82: review-only package completed with 25/25 local tests. P83 adds a
read-only operator metadata inspector, a synthetic fixture suite, and
a strict **12-item** Staging identity/deployment/rollback evidence matrix.

This is **not** a deployable patch, a completed rollback, an IAM review,
or backend App Check attestation. The original P80 deployed guard drift
is unresolved and the P81/P82 patch remains isolated.

## Operator metadata check (not executed in CI)

`production/scripts/p83-staging-identity-rollback-readonly.py` requires
`--inspect` and active `packtook-staging`. It reads each of the five
Gen 2 Functions metadata twice and checks source generation presence,
runtime identity presence, revision presence and possible codebase label
presence. It never prints service account addresses, archive identifiers,
IAM bindings, environment variables, URLs or secrets.

It compares runtime identity equality across the five Functions in RAM.
If identities are shared, that alone does not prove excessive privilege.
A codebase label, if present, is **not** sufficient to certify Firebase CLI
ownership or a safe deployment selector. Source generation metadata
presence also does not prove a usable rollback.

The exact Codebase ownership, IAM scope, App Check backend setting,
rollback restoration feasibility and monitoring must be reviewed
independently before a deployment plan is authorized.

## Scoped read-only Cloud Shell command

Run from a clean P83 review branch checkout with the active project
`packtook-staging`:

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p83-staging-identity-rollback-evidence \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
python3 "$WORKDIR/packtook/production/scripts/p83-staging-identity-rollback-readonly.py" --inspect
```

No `npm ci`, Google credentials file, secrets access or elevated IAM action
is necessary for this check. The script fails closed if the active project
is not Staging. If one Function cannot be described, it returns
`P83_EVIDENCE=NOT_VERIFIABLE`.

## Remaining 12 validation tasks

- Confirm existing status and credit callable codebases and mappings.
- Verify exact runtime service identity and least privilege IAM review.
- Capture immutable pinned source generations and independently verify
  recoverable source and a tested rollback.
- Confirm that an eventual deployment targets only status Functions.
- Prove live App Check, semantic compatibility, incident monitoring,
  and owner-approved Staging-only change window.

All twelve evidence fields start `NOT_VERIFIED`. Even if later populated
as VERIFIED, this offline classifier **cannot** grant deployment: live
security proofs and independently approved change control are separate
gates.

**No Cloud writes, IAM changes or deployment. RELEASE=NO_GO_RELEASE.**
