# PACKTOOK P108 — Archived Status Callable Guard Reference Classification

## P107 live operator evidence

The two archived callable wrappers are `onCall`, while the reviewed Git
source uses `guardedCall`. The two handler bodies differ. Archived
`recordingStatus` and Git `recordingStatus` both contain `ownerRef`
references and all five static response fields. Archived
`usageStatus` uses `ensureAccount`, but shows only some static
response fields; this could be an indirect helper and is not
equivalence evidence. P107 explicitly does NOT prove authorization
bypass or runtime App Check.

## P108 scoped operator probe

P108 reads the SAME TWO pinned-by-metadata current build source ZIPs
as P107, in bounded memory, and reports only fixed-choice lexical
indicators for each status callable:
- whether `enforceAppCheck:true` or `false` occurs inline in the
  `onCall` options, otherwise `OPTION_NOT_INLINE`;
- whether the status body references `uid(req)`, `req.auth`, or an
  explicit guard helper, otherwise no such reference found;
- presence of a top-level `function uid` definition;
- presence of `ensureAccount` usage;
- whether the handler's result is a direct object or an indirect
  function call.

**Important:** A function may enforce authentication via a helper,
and an inline configuration is not proof of runtime App Check.
Absence of a lexical reference does not prove a bypass.
This tool does not execute archived user code, resolve transitive
dependencies, read live customer documents or call any endpoint.
Results are purely a code-review triage aid.

It prints no source content, paths, Source ZIP URLs, hashes, resource
identifiers beyond the two expected function names, tokens or raw
exception messages. Every source ZIP is limited by the prior P106
size bound and rechecked for GCS generation stability.

## Single Staging-only Cloud Shell command

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p108-archived-guard-path-readonly \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"

echo "=== P108 ARCHIVED STATUS GUARD REFERENCES ==="
set +e
timeout --signal=TERM --kill-after=3s 155s \
  python3 -u "$WORKDIR/packtook/production/scripts/p108-archived-guard-path-readonly.py" \
  --inspect
RESULT=$?
echo "P108_EXIT_CODE=$RESULT"
echo "P108_DIAGNOSTIC_COMPLETE"
```

No IAM, deploy, merges, traffic changes, Production or credit writes.
Current source ZIP is not verified as the exact serving revision.
P80 guard drift remains UNREMEDIATED, P99 account parity remains
NOT_EQUIVALENT, backend App Check and full deployment planner are
unverified. `NO_GO_RELEASE`.
