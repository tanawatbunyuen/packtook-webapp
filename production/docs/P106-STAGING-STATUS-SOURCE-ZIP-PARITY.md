# PACKTOOK P106 — Current Status Source ZIP Parity (Read-only)

P104 owner evidence: all five Gen2 Functions have build source references,
but all five references differ. This does **not** mean the source code
differs. P105 confirmed that Firebase CLI can group functions by matching
names when codebase labels are absent in a synthetic inventory. Neither
step proves source-to-Git parity or deployment planner safety.

P106 compares the **original current build source ZIP** for the two
Status Functions against checked-out `production/functions/index.js`.
The comparison is scoped to `packtook-staging`, two named Gen2 Functions
in `asia-southeast1`, GCS source object size <=16MB, and a single
`index.js` entry uncompressed <=4MB.

It uses gcloud Functions describe and GCS objects describe and cat.
No source is written to disk. No source content, object URL, token,
digest, hash, raw exception or account ID appears in stdout. Only
`MATCH`, `DIFFERENT`, or `NOT_LOCATED` is printed per Status
Function. The tool never modifies Staging or Production and never
changes IAM, Cloud Run traffic, payments, credits, or deployments.

**The source ZIP might be unavailable** with operator's permission,
or not use the expected structure. Such cases must fail closed.
A source ZIP comparison alone does not prove that it matches the exact
currently running Cloud Run Revision, which requires separate immutable
provenance evidence. This tool also does NOT determine the known-good
rollback revision.

## One Staging-only Cloud Shell command (read-only)

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p106-staging-status-source-parity-readonly \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"

echo "=== P106 STAGING CURRENT SOURCE PARITY ==="
set +e
timeout --signal=TERM --kill-after=3s 135s \
 python3 -u "$WORKDIR/packtook/production/scripts/p106-staging-status-source-parity-readonly.py" \
 --inspect
RESULT=$?
echo "P106_EXIT_CODE=$RESULT"
echo "P106_DIAGNOSTIC_COMPLETE"
```

This command is read-only but reads the two GCS build ZIPs into bounded
memory on the operator machine. The archives are not uploaded to GitHub.
No real credit/function source is changed.

P80 Guard Drift remains UNREMEDIATED; P99 original legacy account
auto-provisioning is NOT_EQUIVALENT to the guarded P98 Candidate;
deployed source-to-revision parity, deployment deletion plan,
backend App Check and rollback remain NOT_VERIFIED. NO_GO_RELEASE.
