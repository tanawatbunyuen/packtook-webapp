# P144 — Compare verified cache SHA-256 and classify actual startup stages

P143 Cloud Shell operator results: one JAR in original cache and private cache, each 138,093,843 bytes, both ZIP CRC-valid and no symlinks. Counts and bytes alone did not prove identity. P142 log (17 lines) flagged generic download/update and Firestore terms but not a confirmed active download.

P144 **reads only** the existing private startup log and the two cached JAR files. It compares SHA-256 digests in memory without displaying hashes, file paths, log lines, URL strings or secrets. It classifies more specific signals: explicit download begun, completed, version check, Java startup, ready/error, last recognized stage. A stage count does not prove the underlying process was started. No new emulator start or Firebase calls.

## Run in Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p144-emulator-startup-phase-diagnostic
git worktree add --detach "$HOME/packtook-p144" origin/review/p144-emulator-startup-phase-diagnostic
cd "$HOME/packtook-p144"
python3 audit/p144-emulator-startup-phase.py
```

Only share `P144_` lines; do not paste private log or download filenames. P144 PASS does not approve an import of Owner source or a Cloud deploy. Keep `NO_GO_OWNER_IMPORT` / `NO_GO_DEPLOY`.
