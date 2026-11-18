# PACKTOOK P87 — Source Provenance & Rollback Inspection

**Scope: REVIEW ONLY. No automatic approval, Cloud writes, IAM changes,
source object downloads, Firebase deploy or production changes.**

## Current evidence

- Owner P80: deployed Staging `recordingStatus` and `usageStatus`
  show `DRIFT_REVIEW_REQUIRED` against reviewed guard dependencies.
- Owner P83/P84: all five named Gen 2 Functions are ACTIVE and their
  source/revision metadata stayed stable. At least two share a runtime
  identity. Source Pin is NOT shared between status and credit groups.
- P85: checked-out repository declares `beta` Firebase codebase and
  defines all five callable exports in `production/functions/index.js`.
  This does **not** establish actual deployed codebase ownership.
- P86: no safe deploy selector or confirmed restorable rollback.

## P87 enhancements

`production/scripts/p87-source-provenance-readonly.py`:
- checks active gcloud project is exactly `packtook-staging`;
- reads metadata for all five named Functions twice;
- uses the strict P61 `pinned_source` validator requiring a
  generation-pinned source ZIP with bounded naming format;
- classifies per-function drift and source provenance;
- does not print archive names, generations, service accounts,
  immutable revisions, bucket names, URLs or secrets;
- **does not download source**, invoke Cloud Storage, inspect IAM or
  prove a prior version is restorable.

`production/ast-review/p87-provenance-gate.cjs` adds twelve mandatory
evidence fields, initialized `NOT_VERIFIED`. Even a fully marked
template never authorizes deployment without independent attestation.

## Operator Cloud Shell: metadata only

An operator may choose to inspect live Staging provenance **after P87
CI passes**, from a clean checkout:

```bash
set -e
WORKDIR=$(mktemp -d)
git clone --depth 1 --branch review/p87-staging-provenance-rollback-inspection \
  https://github.com/tanawatbunyuen/packtook-webapp.git "$WORKDIR/packtook"
python3 "$WORKDIR/packtook/production/scripts/p87-source-provenance-readonly.py" --inspect
```

No npm install is needed. The script has no Cloud writes; it prints
redacted categories. It cannot establish a past source as a known-good
rollback or verify source-to-Git commit mapping. CI never executes
`--inspect`.

## Next independent work

A qualified reviewer must determine the live deployment and source-to-
commit mapping, exact scoped selector, known-good prior revision,
restorable source archive, effective IAM and backend App Check behavior.
Any restore drill or Staging code change requires a separately
authorized change procedure and monitored rollback path.

**P87_STAGE_DEPLOY=BLOCKED; RELEASE=NO_GO_RELEASE.**
