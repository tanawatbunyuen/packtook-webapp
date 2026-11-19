# PACKTOOK P109 — Archived UID Helper & Shared onCall Options

## Starting point
P108 operator output reported that both original Staging archived
status handlers use `onCall(options,...)`, call `uid(req)`, and have a
top-level `uid` helper. It did **not** find `enforceAppCheck`
inline in either callable invocation. This does not establish whether
the shared `options` variable or other backend controls enforce App Check.

P109 inspects exactly the same two bounded current Staging build ZIPs,
locates the shared identifier passed to `onCall` and its one-line
`const` declaration, and detects lexical references in the top-level
`uid` helper to Auth, verified email and claims/membership.

The result is classification only. A literal `enforceAppCheck:true`
does not prove backend enforcement; an Auth reference does not prove
a sound authorization check. Absence of an inline literal does not
prove a bypass. It never executes downloaded JS, probes live callable
endpoints, reads a Firestore account, or outputs source, object names,
URLs, principals or hashes.

## Operator read-only command (Staging only)

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p109-archived-uid-options-audit \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo "=== P109 STAGING SHARED UID AND OPTIONS REVIEW ==="
set +e
timeout --signal=TERM --kill-after=3s 155s \
  python3 -u "$WORKDIR/packtook/production/scripts/p109-archived-uid-options-readonly.py" \
  --inspect
RESULT=$?
echo "P109_EXIT_CODE=$RESULT"
echo "P109_DIAGNOSTIC_COMPLETE"
```

The tool reads source ZIPs in bounded memory on the trusted operator
machine and checks GCS object generation stability through the P107
helper. No source upload to GitHub. No roles, deployment, traffic,
credit changes or production actions. P80 Guard Drift UNREMEDIATED;
P99 Legacy Account Parity NOT_EQUIVALENT, effective App Check and
known-good recovery NOT_VERIFIED. Release NO_GO_RELEASE.
