# P160 — Verified resumable Firestore v1.22.0 range download

## Operator evidence

P159 actual Cloud Shell: official artifact HTTP 206, requested/read 1,048,576 bytes, private cache has >=500 MB free. P158 one-shot GET returned NETWORK_OR_IO_FAILURE, but HTTP HEAD P157 worked with total size 136,707,194 bytes. A range-based resumable transfer is justified; it is not proof long transfers are reliable.

## Implementation

- Fixed official v1.22.0 artifact URL and expected 136,707,194 bytes; 1 MiB bounded Range GET requests with exact `Content-Range`/length checks, read at most one extra byte per request.
- Persistent private partial file under the existing isolated emulator HOME. Complete chunk data is fsync'ed before moving to the next offset; transient failures preserve completed chunks across runs. No arbitrary overwrite of target, no following symlinks.
- Overall per-run script budget of 210 seconds (plus at most a single in-flight read) and two retries per chunk. Each execution that reaches the deadline returns `P160_RESULT=TIME_BUDGET_REACHED_RESUMABLE` with saved bytes. Repeat same command to resume.
- After all 136,707,194 bytes arrive: validate exact size, JAR zip structure and full entry CRC, then hard-link atomically to the final v1.22.0 filename in the isolated cache (and unlink partial). Old v1.21.0 stays intact.
- SHA-256 is reported for audit, but not yet compared with a separately authenticated official digest; ZIP CRC is an integrity check, not publisher authenticity proof. Transfer is HTTPS to a fixed official host.

### Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p160-resumable-firestore-range-download
if [ ! -d "$HOME/packtook-p160" ]; then
  git worktree add --detach "$HOME/packtook-p160" origin/review/p160-resumable-firestore-range-download
fi
cd "$HOME/packtook-p160"
python3 audit/p160-resumable-firestore.py --resume-official-only
```

If the status is `TIME_BUDGET_REACHED_RESUMABLE` or `NETWORK_OR_IO_FAILURE_RESUMABLE` with a nonzero `P160_PERSISTED_BYTES`, run the same command again later to continue (the partial file remains private). Do not run duplicate downloader processes concurrently. Do not rename/copy an unverified partial file to the final JAR.

Only after `P160_JAR_SIZE_ZIP_CRC_VALID=TRUE` should a single demo-only Firebase Emulator startup be attempted, followed by real Auth/Firestore identity attestation. Never import recovered Owner source or deploy staging/production before security approval.
