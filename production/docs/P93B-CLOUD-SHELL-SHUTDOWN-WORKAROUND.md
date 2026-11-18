# P93B — Cloud Shell Console Shutdown Workaround

The P93 v1 operator workflow could perform 3 Registry lookups per
Function plus multiple other gcloud calls and then repeat for the next
Function. Each subprocess had a separate timeout. A Cloud Shell console
shutdown alone does not establish which command failed, or whether the
Cloud Shell VM/container session was recycled, exhausted or disconnected.

P93B is a **new bounded operator tool**, separate from the original
P93 script. It reads one Function and its current revision and performs
one Artifact Registry image describe only. No full revision list and no
historical image checks. A run invokes at most five **sequential**
gcloud commands with a 12-second timeout each. It prints the step before
each read and NEVER prints raw gcloud errors, registry URLs, SHA-256
digests, tokens, secrets or service principal names.

## Run only one function at a time (Staging, read-only)

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch hotfix/p93-cloud-shell-bounded-diagnostic \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo "=== P93B CURRENT IMAGE CHECK: recordingStatus ==="
set +e
timeout --signal=TERM --kill-after=3s 75s \
  python3 -u "$WORKDIR/packtook/production/scripts/p93b-cloud-shell-safe-readonly.py" \
    --inspect-current --function recordingStatus
RESULT=$?
echo "P93B_EXIT_CODE=$RESULT"
echo "P93B_DIAGNOSTIC_COMPLETE"
```

If this completes and Cloud Shell is stable, separately run the same
script with `--function usageStatus` after checking the output. Do not
loop two functions. If Cloud Shell shuts down again, stop running the
diagnostic and report the last visible P93B_STEP line, not raw secrets.
No need to increase resources, alter IAM or retry aggressively.

**Interpretation:** Even matching current image digest metadata is
not known-good historical rollback, full image retrieval, digest
signature validation, Source-to-Git mapping, live backend App Check or
tested deployment selector. Security Guard Drift remains unresolved.
P93B has no Cloud writes, traffic changes, IAM changes, deployment or
Production access. RELEASE=NO_GO_RELEASE.
