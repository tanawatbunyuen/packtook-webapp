# P127 — Staging source archive recovery preflight

P126 Cloud Shell confirmed that **6/6** build source archives have accessible GCS metadata, including the four Owner Functions absent from reviewed Git. This step reads the exact referenced build archives into a short-lived private Cloud Shell temporary directory, computes SHA-256 for each archive, scans JS/TS files for the four exact Owner Function identifiers, and deletes local copies on exit.

No cloud mutations, Cloud Functions requests, source code printing, bucket/object path printing, Git commits, Git uploads, environment variable or Secret Manager reads. **It does read the source archive bytes** into local temporary storage, so run only under an authorized staging Cloud identity.

Limits: archive 5 MiB each, 3 MiB per file, 20 MiB total uncompressed, 1,000 entries. Rejects path traversal and archive symlinks. A symbol hit is not proof the exported handler is correct or safe. Four matching ZIP SHA-256 fingerprints indicate byte-identical packages; they still do not establish parity with the reviewed Git source or prove deployed image source provenance.

## Run in authenticated Cloud Shell

Use the durable HOME worktree rather than `/tmp` (which may disappear between Cloud Shell sessions). Avoid overwriting any local changes:

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p127-staging-build-archive-recovery
git worktree add --detach "$HOME/packtook-p127" origin/review/p127-staging-build-archive-recovery
cd "$HOME/packtook-p127"
python3 -m py_compile audit/p127-stage-source-archive-preflight.py
python3 audit/p127-stage-source-archive-preflight.py
```

If worktree path already exists, reuse it only after checking its revision; do not reset or delete work without checking local changes.

**Safety status:** The P121 owner-source guard and P117 NO_GO_STAGING remain active. Any later recovery of original source requires a secure source inspection and review; do not deploy or paste the source archive publicly.
