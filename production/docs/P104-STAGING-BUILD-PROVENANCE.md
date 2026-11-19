# PACKTOOK P104 — Build Provenance Without Codebase Labels

## P103 verified operator result
All five investigated Gen2 Functions have no
`firebase-functions-codebase` label. That is NOT evidence of
non-membership in the local `beta` codebase. Do not write labels or
IAM roles to force a diagnostic to pass.

P104 reads only build and service metadata of the same five named
functions, under the active `packtook-staging` project. It checks
entrypoint, runtime and Cloud Run service scope, and compares opaque
build-source references for equality. No raw bucket, object name,
generation, URLs, source code, digest, service resource name, or identity
is ever printed. At most six gcloud reads, each bounded to 12 seconds.

Even when all five source references are equal, this does **not** prove
a shared Firebase codebase, reproducible source, actual deployed Git
commit, safe deploy selector, image pullability or rollback. Distinct
source references may simply reflect staggered deployments.

## One Staging read-only operator command

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p104-staging-build-provenance-readonly \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo "=== P104 STAGING BUILD PROVENANCE ==="
set +e
timeout --signal=TERM --kill-after=3s 95s \
  python3 -u "$WORKDIR/packtook/production/scripts/p104-build-provenance-readonly.py" \
    --inspect
RESULT=$?
echo "P104_EXIT_CODE=$RESULT"
echo "P104_DIAGNOSTIC_COMPLETE"
```

No gcloud artifact lookup, Cloud Functions source download, IAM, deploy
or traffic modification. P80 Security Guard Drift remains
UNREMEDIATED. P99 legacy account compatibility remains NOT_EQUIVALENT.
`RELEASE=NO_GO_RELEASE`.
