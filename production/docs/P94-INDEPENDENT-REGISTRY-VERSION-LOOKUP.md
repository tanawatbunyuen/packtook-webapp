# P94 — Independent Artifact Registry Version Lookup

Owner P93D on Staging confirmed that the current recordingStatus
revision refers to an image whose Docker Images Describe lookup returned
not found, while the Artifact Registry repository itself was visible.
This does not establish whether the digest was deleted or the Docker
Images Describe lookup used a different representation.

The Google Cloud CLI separately supports `gcloud artifacts versions
describe` with a specific package, repository, location, project and
version. P94 reuses P93C's safe current-function check and, ONLY when
Docker Images Describe returns not-found, checks that single version
with the second CLI surface. It does not list a whole repository,
download image bytes or inspect IAM. No raw image name, digest, CLI
stderr, service principal or secret is shown.

This check is useful for classifying inconsistent lookup paths but
**does not** prove that an image can be pulled, run or rolled back.
Missing/hidden version results remain fail-closed.

## Optional operator Cloud Shell (one Staging Function only)

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p94-independent-registry-version-lookup \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"

echo "=== P94 INDEPENDENT REGISTRY VERSION ==="
set +e
timeout --signal=TERM --kill-after=3s 90s \
  python3 -u "$WORKDIR/packtook/production/scripts/p94-independent-version-lookup-readonly.py" \
    --inspect-current --function recordingStatus
RESULT=$?
echo "P94_EXIT_CODE=$RESULT"
echo "P94_DIAGNOSTIC_COMPLETE"
```

Maximum 6 serial read-only Cloud CLI calls, each limited to 12 seconds.
No IAM changes, deploy, traffic modifications, Cloud writes or
Production access. Known-good rollback remains NOT_SELECTED and
P80 deployed guard drift UNREMEDIATED. RELEASE=NO_GO_RELEASE.
