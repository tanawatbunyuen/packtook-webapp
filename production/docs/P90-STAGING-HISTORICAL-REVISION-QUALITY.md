# PACKTOOK P90 — Staging Historical Revision Quality

## Verified earlier evidence

The owner's P89 read-only Cloud Shell output returned 20 visible revisions
for `recordingStatus` and 21 for `usageStatus`, and both original
Cloud Functions' metadata remained stable. The operator previously
demonstrated current pinned source availability for both functions (P88).
No previous revision is proven known-good, safely restorable or mapped
to immutable prior source generation. P80 confirmed deployed original
callable guard drift remains unremediated.

## P90 operator-only inventory

`production/scripts/p90-staging-revision-quality-readonly.py` requires
`--inspect` and active `packtook-staging`. It obtains the Cloud
Function to Cloud Run service mapping from live Gen2 metadata, then
reads the visible Cloud Run revision history for exactly two original
status functions.

It reports aggregate counts only: total visible revisions, revisions
with reported Ready=True, non-empty creation time and container image
reference. It does not display identifiers, images, principal addresses,
environment values or secrets. No source bytes or private user data
are accessed.

These are METADATA COUNTS, not evidence that an earlier revision was
ever secure, healthy under realistic workloads, capable of being
restarted, or tied to a restorable source object. The script does not
rank or choose rollback candidates and does not change traffic.

## Operator option, read-only

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p90-staging-revision-candidate-inventory \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo '=== P90 REVISION METADATA QUALITY ==='
set +e
timeout --signal=TERM --kill-after=5s 120s \
  python3 -u "$WORKDIR/packtook/production/scripts/p90-staging-revision-quality-readonly.py" --inspect
RESULT=$?
echo "P90_EXIT_CODE=$RESULT"
echo 'P90_DIAGNOSTIC_COMPLETE'
```

## Release and rollback boundary

There is still no verified prior known-good source, independent
restore test, deployed Firebase codebase ownership, safe deploy selector,
backend App Check attestation or least privilege IAM review. Even
visible Ready=True metadata is not a runtime security attestation.
The protected P81/P82 remediation candidate is unregistered and has
not changed Staging. Release remains NO_GO_RELEASE.

CI runs synthetic mock metadata and local evidence tests only.
No Cloud calls, deployments, traffic changes or IAM operations.
