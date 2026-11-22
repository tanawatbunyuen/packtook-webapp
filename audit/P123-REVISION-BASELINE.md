# P123 — Staging six-function revision baseline lock

Baseline is the exact, operator-supplied **P122 Cloud Shell** revisions for six Cloud Functions in `packtook-staging` (`asia-southeast1`). It records no secret values.

This does **not** establish deployed Git SHA, Firebase codebase ownership, source parity, or App Check readiness. It detects whether a future read-only `gcloud functions describe` snapshot has changed relative to P122.

- `BASELINE_MATCH`: revision, state and codebase label unchanged; **still NO_GO_DEPLOY**.
- `DRIFT_OR_UNVERIFIED`: any change in revision, state or label; stop and investigate.
- `UNAVAILABLE` or ID mismatch: fail closed; do not deploy.

## Run from Cloud Shell on a separate worktree

```bash
cd /tmp/packtook-p122
git fetch origin review/p123-staging-six-revision-lock
git worktree add --detach /tmp/packtook-p123 origin/review/p123-staging-six-revision-lock
cd /tmp/packtook-p123
bash -n audit/p123-six-revision-readonly.sh
bash audit/p123-six-revision-readonly.sh
```

The script uses only `gcloud functions describe --v2` on the staging project and selected functions, and cleans its temporary files. No staging or production writes, no source archives and no secret reads. The original four Owner Functions are protected by the P121 Source Drift Gate.

**All P117 release gates remain NO_GO**, including unproven Cloud Functions source revision and codebase attribution, absent confirmed App Check staging site key, Hosting drift and pending live E2E.
