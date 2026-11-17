# PACKTOOK V7 — Deployed Source Attestation (Staging only)

## Why
Five Staging Gen2 callables are ACTIVE; each has a distinct pinned Source Artifact identity. Their Cloud Build metadata is readable, but none exposes a verified Git commit. Staging Hosting's Firebase bridge initializes App Check, while the reviewed branch's Staging bridge does not. Backend enforcement is **NOT PROVEN**.

## Scope
Read only the exact, generation-pinned `buildConfig.source.storageSource` ZIP for each of these Functions: `reserveCredit`, `finalizeCredit`, `recordingStatus`, `recoverStaleVideoReservation`, `usageStatus`. Strict Staging project active-config + env guards. Archive output is consumed in RAM and never stored; no archive, source, secret, storage path, or raw error is printed. Size bound 16 MiB archive / 1 MiB handler. Expected handler ZIP member must be exactly `index.js` or `functions/index.js`, uniquely.

The script checks **byte equality** of archive handler against the checked-out `functions/index.js`. It reports a coarse static `enforceAppCheck` literal signal, but never claims that this proves the export is configured or that deployed runtime enforcement works.

## Usage in Cloud Shell
First verify the worktree SHA matches the reviewed commit before running.

```bash
gcloud config set project packtook-staging
export RR_STAGING_PROJECT_ID=packtook-staging
python3 -m unittest -v production/scripts/test-rr-v7-deployed-source-attestation-readonly.py
python3 production/scripts/rr-v7-deployed-source-attestation-readonly.py --inspect-source
```

Requires `gcloud functions describe` and GCS object read permissions on Staging's *specific* v2 source archive. Access denial, source unavailable/archived, ambiguous ZIP handler path, missing object generation, malformed archive, or byte drift must remain BLOCKED/REVIEW_REQUIRED. Do not broaden project/bucket IAM or run against Production. The `--inspect-source` switch explicitly enables downloading Staging's source archive bytes **only to RAM**, which may still contain sensitive application source; execute in trusted operator Cloud Shell only. Do not print, save, or share raw archive contents.

## Interpretation
- `MATCH` proves the compared file bytes are equal to this checked-out review branch only. It **does not** prove all deployed dependencies, Cloud Run revision pinning or runtime App Check behavior.
- `DRIFT` means deployed archive's handler bytes differ. **Never overwrite deployed code just to make hashes match.**
- `NO_LITERAL_DECLARATION` is a static hint and does not prove backend enforcement is disabled (e.g. dynamic per-export options).
- Even `TRUE_LITERAL_PRESENT_NOT_HANDLER_PROOF` is **not** proof that all five exported Functions enforce App Check.
- Keep `V7_SOURCE_ATTESTATION_GATE: INSPECTION_ONLY`, `DEVICE_TEST_AUTHORIZED: NO` and `RELEASE: NO_GO_RELEASE` until the separately approved controlled validation and operational review.

## Exit criteria for future review
After operator results, inspect individual callable exports and deployment trust chain. Compare actual source and deployment configuration with appropriate change control. No Firebase deploys, Cloud Functions invocations, Firestore writes, Omise operations, browser camera requests, or Production changes are in this V7 stage.
