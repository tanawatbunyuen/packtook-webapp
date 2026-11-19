# PACKTOOK P110 — Composite onCall Options and Shared App Check Static Analysis

## Actual P109 Staging findings

Both archived Staging Status Handlers call `uid(req)`, and the
archived `uid` helper includes references to Auth, verified email,
and Claims/Membership. Both handlers' `onCall` options were
`NOT_SIMPLE_OPTIONS_IDENTIFIER` in P109; P109 could not resolve the
shared variable or expression into an App Check setting. These are
only lexical indicators, NOT proof of runtime enforcement or bypass.

P110 checks complex first `onCall` arguments, including
`onCall({...options,enforceAppCheck:true}, ...)`, left-to-right
object spread override order, and static shared const object
expressions. It reports fixed categories:
`STATIC_TRUE`, `STATIC_FALSE`,
`NO_STATIC_SETTING_FOUND`, or `UNRESOLVED`.

A static true/false literal is **not proof** of runtime App Check. A
missing or unresolved static setting is **not proof** of a security
bypass. P110 does NOT execute remote JS, authenticate users, inspect
secrets, or simulate Firebase runtime. Unsupported expressions and
unknown spreads are classified `UNRESOLVED` and fail to establish
an App Check conclusion.

## Single read-only Cloud Shell step

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p110-oncall-composite-options-analysis \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo "=== P110 STAGING COMPOSITE OPTIONS ==="
set +e
timeout --signal=TERM --kill-after=3s 155s \
  python3 -u "$WORKDIR/packtook/production/scripts/p110-composite-oncall-options-readonly.py" \
  --inspect
RESULT=$?
echo "P110_EXIT_CODE=$RESULT"
echo "P110_DIAGNOSTIC_COMPLETE"
```

Two source ZIPs are read in bounded memory on the operator machine;
objects' GCS generations are checked before and after via P107.
No raw code, paths, bucket names, URLs or source hashes are output.
The current source ZIP is not cryptographically tied to the serving
Cloud Run revision. No new Cloud IAM roles, deployments, uploads,
customer data, credit writes or traffic changes.

P80 Guard Drift is still UNREMEDIATED. P99 Legacy Account Parity
remains NOT_EQUIVALENT. Full deployment planning and known-good restore
remain NOT_VERIFIED. Release NO_GO_RELEASE.
