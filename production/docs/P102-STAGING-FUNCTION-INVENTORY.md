# PACKTOOK P102 — Staging Gen2 Function Inventory (Read-only)

## Why a live read is now needed
P101 executed the real pinned `firebase-tools@15.29.0` endpoint
filter/parser against synthetic inventories and found that matching
`recordingStatus` can ALSO match `recordingStatus-child`, and
matching `usageStatus` can match `usageStatus-child`. The P100
two-name selector **cannot be approved based only on syntax**.

P102 reads the actual `packtook-staging` Gen2 Functions inventory,
twice for stability, using documented `gcloud functions list --v2
--regions=asia-southeast1 --project=packtook-staging --format=json`.
No image Registry reads, source downloads, secrets, user documents,
IAM policy or Cloud mutations.

Redacted output contains only:
- total number of visible Gen2 Functions in this region;
- presence of the TWO target status Functions;
- presence of the THREE credit-critical Functions;
- count of other Functions with a `recordingStatus-` or
  `usageStatus-` prefix, never their names;
- observed Firebase codebase labels, if they exist.

If codebase labels are absent, we report absence; we do not assert
that deployed ownership is `beta`. If any status/credit Function is
absent, any out-of-scope resource appears, results are unstable,
or a prefix collision is observed, the diagnostic exits with code 2.

## Single read-only operator command
Requires a trusted authenticated Cloud Shell with active project
`packtook-staging`. No new credentials or role changes.

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p102-staging-function-inventory-readonly \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo '=== P102 STAGING GEN2 FUNCTION INVENTORY ==='
set +e
timeout --signal=TERM --kill-after=3s 65s \
  python3 -u "$WORKDIR/packtook/production/scripts/p102-staging-function-inventory-readonly.py" \
    --inspect
RESULT=$?
echo "P102_EXIT_CODE=$RESULT"
echo 'P102_DIAGNOSTIC_COMPLETE'
```

**The command is read-only**, but proof of no observed name collisions
does not establish deploy-time selection or absence of deletions.
The full Firebase deployment planner, source/Cloud mapping, known-good
restore and P99 missing-account compatibility remain unverified.
P80 live status guard drift is unremediated.

P102 CI exercises only synthetic mocks. No production access, writes,
IAM changes, source/image downloads, deployments or traffic changes.
`NO_GO_RELEASE`.
