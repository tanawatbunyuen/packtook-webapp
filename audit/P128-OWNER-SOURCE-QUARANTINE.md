# P128 — Quarantined source recovery, no deployment

The authenticated P127 Cloud Shell result confirms four Owner Functions share an identical ZIP SHA-256 `e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456` and the ZIP contains all four Owner Function symbol names. P128 copies only **one** of the four identical GCS archives referenced by `ownerGetCustomerAdjustmentHistory`, pins project `packtook-staging` and region `asia-southeast1`, requires the exact ZIP SHA-256, and extracts to a private local HOME directory outside Git.

Safe handling:
- No upload to GitHub and no deploy.
- Do not copy the recovered folder into a tracked repository or paste its contents into chat. It may include credentials, internal comments, or proprietary code.
- Do not execute recovered scripts, `npm install`, or `npm run` before a security review.
- ZIP path traversal, symbolic links, duplicate paths, oversized files and SHA mismatch fail closed.
- The recovery folder is mode 0700, regular files mode 0600. A partial recovery folder is removed if the process fails.
- Only a manifest of path names, sizes and hashes is written locally; console prints no source lines.

## Cloud Shell command

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p128-owner-source-quarantine
git worktree add --detach "$HOME/packtook-p128" origin/review/p128-owner-source-quarantine
cd "$HOME/packtook-p128"
python3 -m py_compile audit/p128-owner-source-quarantine.py
python3 audit/p128-owner-source-quarantine.py
```

Default output: `$HOME/.packtook-recovery/p128-owner-e82154a69b8d`.

Recovery of an archive does not mean source-to-runtime parity or code correctness. Next gate is an offline security/functional diff review, protecting all four Owner Functions, no real Cloud modifications. Staging is still `NO_GO_DEPLOY`.
