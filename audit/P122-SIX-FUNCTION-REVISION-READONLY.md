# P122 — Six-function staging revision inspection

Read-only Cloud Shell script; not a deploy instruction.

Checks two Status Functions and four Owner Functions. P120 established that all four Owner functions are Cloud-only relative to the reviewed source. Uses only `gcloud functions describe --v2 --format=json` in `packtook-staging`, region `asia-southeast1`.

Prints selected nonsecret metadata only: state, entry point, Firebase codebase label, service revision, update time. No environment variable or secret values printed.

## Run from an existing Cloud Shell workspace

```bash
cd /tmp/packtook-p120
git fetch origin review/p122-six-function-revision-readonly
git worktree add --detach /tmp/packtook-p122 origin/review/p122-six-function-revision-readonly
cd /tmp/packtook-p122
bash -n audit/p122-six-function-revision-readonly.sh
bash audit/p122-six-function-revision-readonly.sh
```

The revision metadata may be UNSET even when other metadata indicates a revision exists. This does not prove missing Cloud Run revisions. A revision name does not prove source Git commit parity. Remain NO_GO on deployment pending codebase/source ownership and P117 readiness checks.
