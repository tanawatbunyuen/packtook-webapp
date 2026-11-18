# PACKTOOK P93C — Diagnose Registry-stage NOT_VERIFIABLE

Operator P93B reached `P93B_STEP=READ_REGISTRY_DIGEST_METADATA`
and printed `NOT_VERIFIABLE` before any stability recheck.
This does **not** establish an actual missing image. Possible
explanations include denied Registry metadata permissions, an expired
digest, invalid registry allowlist path, CLI failure or response shape.

P93C reads the same current status revision, with at most five
sequential `gcloud` commands (<=12 seconds each), one Function per run.
It classifies a Registry error into categories without printing
stderr, service addresses, image reference or SHA256 digest.
It uses Google Cloud's documented scalar output:
`--format=value(image_summary.digest)` instead of assuming a JSON
response structure. It does not list IAM policies or request any
role changes.

## Run just recordingStatus first

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch hotfix/p93c-registry-failure-classification \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo '=== P93C REGISTRY ROOT CAUSE ==='
set +e
timeout --signal=TERM --kill-after=3s 75s \
  python3 -u "$WORKDIR/packtook/production/scripts/p93c-registry-failure-readonly.py" \
    --inspect-current --function recordingStatus
RESULT=$?
echo "P93C_EXIT_CODE=$RESULT"
echo "P93C_DIAGNOSTIC_COMPLETE"
```

If Registry cannot verify, stop; do not change IAM or deploy. The
output distinguishes `REGISTRY_ACCESS_DENIED`,
`IMAGE_OR_REPOSITORY_NOT_FOUND`,
`IMAGE_REFERENCE_OUTSIDE_STAGING_ALLOWLIST`,
`CLI_ARGUMENT_UNSUPPORTED`, `COMMAND_TIMEOUT`,
`DIGEST_FIELD_NOT_RETURNED` and digest mismatch.
Unclassified errors remain unverified, not proof of absence.

A matching metadata digest is not image pullability or known-good
rollback. P80 status Guard Drift remains unremediated.
No Cloud writes, IAM modifications, traffic changes, deployments
or Production access. RELEASE=NO_GO_RELEASE.
