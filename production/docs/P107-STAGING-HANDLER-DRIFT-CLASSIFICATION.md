# PACKTOOK P107 — Redacted Staging Status Handler Drift Classification

## Verified owner evidence (P106)
The source ZIPs returned by the Gen2 Staging Function build metadata
differ from the checked-out GitHub `production/functions/index.js` for
both `recordingStatus` and `usageStatus`. The extracted status
handler texts also differ. This is source drift, not evidence of a
confirmed live authorization bypass. The source ZIP may not represent
the exact currently serving Cloud Run revision.

## P107 diagnostic
The read-only classifier uses the same two build source references
as P106 (bounded to two Functions), with a GCS size/generation check
before and after each in-memory ZIP read. It does not output source,
raw diffs, bucket/object names, hashes, tokens, IDs or URLs.

Only fixed-choice indicators:
- Archived source wrapper class `GUARDED_CALL`, `ON_CALL`, `OTHER_WRAPPER`
- Original Git wrapper class and whether the names match
- `ownerRef`, direct `accounts` path, or other/indirect reference
- Whether the handler text includes `ensureAccount(`
- Whether a fixed set of response field keys appears as static keys
- Coarse text similarity of only the first 12k characters

**These are lexical indicators, not security or runtime proof.**
A helper may apply Auth/App Check outside the body, a field may be
computed indirectly, and a wrapper may be named `guardedCall`
without actually enforcing a policy. Therefore P107 does not
promote any status to FIXED. The plan remains NO_GO_RELEASE.

Source archives are read into memory on the operator's Cloud Shell.
The command never deploys, alters IAM/traffic, reads accounts or
credits, or changes any source. Actual cloud data is NOT fetched by CI.

## Single bounded Staging command

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p107-staging-handler-drift-classification \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"

echo "=== P107 STAGING HANDLER DRIFT CLASSIFICATION ==="
set +e
timeout --signal=TERM --kill-after=3s 155s \
  python3 -u "$WORKDIR/packtook/production/scripts/p107-staging-handler-drift-classify-readonly.py" \
  --inspect
RESULT=$?
echo "P107_EXIT_CODE=$RESULT"
echo "P107_DIAGNOSTIC_COMPLETE"
```

The current source is untrusted for restore until exact deployed
revision/source provenance and safe status-only deploy planning are
proved; P99 legacy auto-provisioning parity remains NOT_EQUIVALENT;
P80 security guard drift remains UNREMEDIATED. NO_GO_RELEASE.
