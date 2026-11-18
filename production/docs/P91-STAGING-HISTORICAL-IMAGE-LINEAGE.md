# PACKTOOK P91 — Staging Historical Image Lineage

## Evidence carried forward
P90 owner Cloud Shell reported 20/20 recordingStatus revisions and
21/21 usageStatus revisions with Ready metadata, creation time, and
non-empty container image references. All source and revision metadata
was stable. Previous known-good source, Source-to-Git mapping,
independently tested rollback and effective App Check/IAM remain unknown.

## P91 new operator-only check
A read-only inspector counts **distinct image references** across the
visible Cloud Run history and verifies the current Function revision
appears in that list. It also reports how many revisions have the same
image reference as the current revision. No image URI/hash or revision
identifier is printed, logged or saved. It does not choose a previous
revision or claim that a shared image is safe.

Cloud Run historical image references can be tags rather than immutable
digests, and images may no longer be accessible. A visible prior image
does not establish recoverability, reproducibility, source-to-commit
equivalence or a secure rollback.

## Optional Cloud Shell (read-only)
Use a new checkout and only the active `packtook-staging` context:

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p91-staging-revision-image-lineage \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo "=== P91 IMAGE LINEAGE ==="
set +e
timeout --signal=TERM --kill-after=5s 120s \
  python3 -u "$WORKDIR/packtook/production/scripts/p91-staging-image-lineage-readonly.py" --inspect
RESULT=$?
echo "P91_EXIT_CODE=$RESULT"
echo "P91_DIAGNOSTIC_COMPLETE"
```

## Decision
P81/P82 remains unregistered; P80 Guard Drift is unremediated.
Do not select a prior revision just because Ready is True.
Separately verify immutable prior source, safe deploy targeting,
restoration in a permitted isolated environment, IAM least privilege,
App Check negative cases, and final owner change authorization.

**No Cloud writes, traffic changes, IAM actions, merges or deployments.
STAGING_DEPLOY=BLOCKED; RELEASE=NO_GO_RELEASE.**
