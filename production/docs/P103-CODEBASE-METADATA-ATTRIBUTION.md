# PACKTOOK P103 — Staging Codebase Metadata Attribution

P102 operator evidence: 27 visible Gen2 functions, both status
functions and all three credit functions present, stable inventory
and zero prefix collisions. But codebase labels were partial or absent.

P103 reads the **five named functions only**, and counts whether the
Firebase codebase label `firebase-functions-codebase` on each function
is `beta`, absent, or inconsistent. All five are checked explicitly.
It prints no raw response, account ID, service URI, digest or
unrelated function names. It never grants roles, modifies IAM, builds,
downloads images, deploys, changes traffic or touches Production.

Even if 5/5 labels say `beta`, they are metadata attribution evidence,
not proof of the real deploy planner behavior or source-to-deployed
equivalence. Absent labels remain UNKNOWN, not proof the functions
do or do not belong to the codebase.

## Cloud Shell opt-in, Staging read-only

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p103-staging-codebase-metadata-attribution \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"

echo "=== P103 STAGING CODEBASE METADATA ==="
set +e
timeout --signal=TERM --kill-after=3s 95s \
  python3 -u "$WORKDIR/packtook/production/scripts/p103-codebase-metadata-readonly.py" \
    --inspect
RESULT=$?
echo "P103_EXIT_CODE=$RESULT"
echo "P103_DIAGNOSTIC_COMPLETE"
```

At most 6 serial gcloud reads, each limited to 12 seconds. Do not
retry repeatedly if Cloud Shell stops; report the last P103_STEP.
No Source-to-Git parity, App Check backend, rollback restorability,
legacy account parity, deployment planner or release approval is
claimed. P80 status Guard Drift remains UNREMEDIATED. NO_GO_RELEASE.
