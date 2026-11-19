# PACKTOOK P93D — Resolve P93C Artifact Registry NOT FOUND

P93C owner console on Staging recorded:
`P93C_REGISTRY_RESULT=IMAGE_OR_REPOSITORY_NOT_FOUND`,
while current Cloud Function and Cloud Run Revision metadata were
readable and stable. The error is **not proof of image deletion**.

P93D performs the same bounded one-Function read-only current
revision inspection, then (ONLY after an image lookup 404) performs
one additional `gcloud artifacts repositories describe` metadata
read to determine whether the repository can be located. It does not
list all historical images, download layers, reveal internal paths or
digests, change IAM, deploy, or modify traffic.

Possible outcomes:
- `REPOSITORY_METADATA_VISIBLE_DIGEST_LOOKUP_NOT_FOUND`:
  repository metadata is readable but the requested image digest lookup
  returned not found. Check image-to-repository mapping later; do not
  assume it has been deleted.
- `REPOSITORY_NOT_FOUND_OR_HIDDEN`:
  repository missing or inaccessible under current identity.
- `REPOSITORY_ACCESS_DENIED`:
  current identity cannot describe repository; no role change is made.
- `REPOSITORY_METADATA_UNVERIFIABLE`: parse or other read failure.

The repository metadata result doesn't establish image pullability or
a verified known-good rollback.

## Staging Cloud Shell (optional, one function only)
```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch hotfix/p93d-registry-404-resolution \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo '=== P93D REGISTRY 404 DIAGNOSIS ==='
set +e
timeout --signal=TERM --kill-after=3s 90s \
  python3 -u "$WORKDIR/packtook/production/scripts/p93d-registry-404-readonly.py" \
    --inspect-current --function recordingStatus
RESULT=$?
echo "P93D_EXIT_CODE=$RESULT"
echo 'P93D_DIAGNOSTIC_COMPLETE'
```

At most 6 sequential gcloud reads, each capped at 12 seconds.
Do not repeat if Cloud Shell disconnects. Report only sanitized result
codes. Do not grant new permissions or deploy to resolve a lookup.

P80 Guard Drift remains UNREMEDIATED. Source-to-Git, prior known-good,
restore feasibility, IAM least privilege, backend App Check and safe
deploy selector remain NOT_VERIFIED. NO_GO_RELEASE.
