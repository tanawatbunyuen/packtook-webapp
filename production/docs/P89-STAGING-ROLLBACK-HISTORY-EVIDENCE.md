# PACKTOOK P89 — Staging Revision History Metadata Preflight

Owner-supplied P88 read **both** current generation-pinned Staging status
source ZIPs successfully. This is current source *readability* evidence.
It **cannot** identify a previous known-good version and does not establish
the ability to restore it.

## P89 operator read-only scope

The script `production/scripts/p89-staging-revision-history-readonly.py`
operates only against `packtook-staging` in `asia-southeast1` and only
`recordingStatus` / `usageStatus`. It gets each Cloud Function's Gen2
Cloud Run service mapping from the Function's actual live metadata, checks
the service identifier remains in the correct project and region, and
reads the **visible Cloud Run revisions list** using `gcloud run revisions
list`. It checks the Function's metadata remains the same after listing.

The script reports only whether more than one revision is visible and
the count, without printing identities, revision names, service URLs,
source archive locations, timestamps, secrets, environment variables or
IAM details. It reads neither source archives nor customer data.
Visible revisions can be incomplete and their existence does **not**
prove that they correspond to safe, restorable prior code.

If the service name is not available, metadata has changed or permissions
deny revision listing, the script fails closed. It cannot establish a
rollback by itself.

## Optional Cloud Shell (no writes, no npm install)

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p89-rollback-history-evidence-preflight \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo '=== P89 REVISION HISTORY METADATA ==='
set +e
timeout --signal=TERM --kill-after=5s 120s \
  python3 -u "$WORKDIR/packtook/production/scripts/p89-staging-revision-history-readonly.py" --inspect
RESULT=$?
echo "P89_EXIT_CODE=$RESULT"
echo 'P89_DIAGNOSTIC_COMPLETE'
```

This is an opt-in Cloud metadata read only. If it fails or Cloud Shell
disconnects, do not retry repeatedly; return the redacted output.

## Remediation dependencies remain

Source of truth for deployed status guard from P80 remains
`DRIFT_REVIEW_REQUIRED` for both original functions. P81/P82 candidate
has not been deployed. P85 showed the checked-out `beta` codebase
defines credit and status exports together. P84/P87 different live source
pins do not prove safe Firebase CLI deploy ownership. IAM least
privilege, live backend App Check, proven prior source rollback, safe
selector and owner release approval remain unresolved.

**P89 does not change IAM/Cloud data or deploy. NO_GO_RELEASE.**
