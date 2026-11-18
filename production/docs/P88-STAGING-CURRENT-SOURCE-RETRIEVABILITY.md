# PACKTOOK P88 — Current Pinned Source Retrievability Evidence

P87 operator reported the same five Staging Gen2 functions stable, strict
pinned GCS source syntax present, and source pins not shared across
status and credit groups. Source metadata does NOT prove archive data can
be read or a known-good prior version can be restored.

## What is newly checked

P88's operator-only tool
`production/scripts/p88-current-source-retrievability-readonly.py`
checks exactly **ONE of the two status functions per run**:
- `recordingStatus`
- `usageStatus`

It reuses P61's Staging-only environment guard, generation-pinned GCS
archive reader, bounded 16-MiB in-RAM source ZIP and strict single-handler
ZIP validation. It reads all five Cloud Functions metadata both before
and after that one selected archive, refusing to certify if revisions
change mid-inspection.

The tool does not print/save source, archive identifiers, bucket names,
credentials, service-account identities, revision names or secrets.
It does not read other Cloud user data. It requires explicit operator
opt-in and won't run in CI or contact Google Cloud by default.

Even a PASS is **only current pinned source retrieval**, not a known-good
prior version, source-to-Git commit parity, true backend App Check, tested
rollback, deploy selector safety, or Staging guard remediation.

## Owner Cloud Shell (optional read-only, after CI)

Run from a fresh clone and with active project `packtook-staging`:

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p88-staging-source-retrievability-evidence \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
echo "=== P88 CURRENT PINNED SOURCE CHECK ==="
for NAME in recordingStatus usageStatus; do
  echo "CHECKING=$NAME"
  timeout --signal=TERM --kill-after=5s 90s \
    env RR_STAGING_PROJECT_ID=packtook-staging P88_STAGING_SOURCE_READ=YES \
    python3 -u "$WORKDIR/packtook/production/scripts/p88-current-source-retrievability-readonly.py" \
      --inspect-current-source --function "$NAME"
done
```

If the command exits nonzero or Cloud Shell disconnects, stop. Do not
retry repeatedly; report the last printed status. Use of `set -e` ensures
a failed first check does not trigger the second read.

## Known release blockers

P80 real Staging source-guard drift is confirmed for both handlers.
The P81/P82 candidate remains isolated and not deployed. The P85
checked-out repository places all five functions in `beta`, but deployed
Firebase codebase ownership and a safe narrowed selector are not proven.
P74 App Check/IAM, P77 operations and rollback remain incomplete.

No deployment command, no Firestore changes, no IAM writes, no
Production use. RELEASE=NO_GO_RELEASE.
