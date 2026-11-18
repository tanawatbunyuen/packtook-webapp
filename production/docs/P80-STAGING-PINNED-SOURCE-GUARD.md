# PACKTOOK P80 — Staging Pinned Source Guard Attestation

P79 operator output: the five Gen 2 Staging Functions were
`STABLE_METADATA_ONLY` at two consecutive metadata reads. That is a useful
precondition but does not establish source integrity, effective backend
App Check or least-privilege IAM.

## P80 candidate

The read-only operator script
`production/scripts/p80-staging-guard-source-readonly.py` reuses the
existing P61 immutable pinned source archive reader and P63 AST dependency
analyzer. It checks the two historical drift targets
`recordingStatus` and `usageStatus`, with before/after metadata
snapshots for **all five** Functions.

It uses the source object generation for each archive to prevent reading
the wrong mutable GCS source object, keeps bounded zip bytes only in memory,
rejects a dirty local review source, and summarizes only guard/metadata
statuses. It never prints source, archive identifiers, hashes, user data,
IAM membership or secrets. Source archives may contain sensitive files, so
this is run only in the owner's trusted authorized Cloud Shell session.

## Operator-controlled inspection (Cloud Shell)

From a **fresh checkout** of the P80 review branch (not an existing
modified working tree), with the active gcloud project
`packtook-staging`, run:

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p80-staging-pinned-source-guard-attestation \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
npm ci --prefix "$WORKDIR/packtook/production/ast-review" --ignore-scripts --no-audit --no-fund
RR_STAGING_PROJECT_ID=packtook-staging \
P80_ALLOW_STAGING_SOURCE_READ=YES \
python3 "$WORKDIR/packtook/production/scripts/p80-staging-guard-source-readonly.py" --inspect-source
```

No IAM, Firebase configuration, Firestore data or Cloud resource is changed.
The P61 archive reader strictly checks project context and disallows
production credentials/project flags. If the immutable archive generation
cannot be read safely the result is NOT_VERIFIABLE and the script exits 2.

**Expected historical drift:** P63 last observed the deployed Staging
`recordingStatus` and `usageStatus` not using the reviewed
`guardedCall(options,...)` wrapper. A fresh P80 DRIFT result would
confirm the drift is still present. A MATCH result would be limited to
static reviewed source tokens and cannot prove runtime behavior.

Even when both names MATCH and metadata stays stable,
`BACKEND_APP_CHECK=NOT_PROVEN`,
`IAM_LEAST_PRIVILEGE=NOT_VERIFIED`, and
`RELEASE=NO_GO_RELEASE`.
No deploy, merge, service-account modification or public signup.
