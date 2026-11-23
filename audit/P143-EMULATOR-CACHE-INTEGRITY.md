# P143 — Diagnose emulator cache integrity without launching Firebase

Operator P142 observed 17 private log lines, generic download/update and Firestore indicators but no Auth or ready indicators. That is **not** proof of a stuck download. P143 checks the preexisting source cache and P141's persistent private cache, counts files and bytes, and validates JAR ZIP integrity locally. It prints no filenames, paths, JAR metadata or raw logs.

The script makes no Cloud or network calls, does not start emulators, and does not import Owner Functions. It may take some time reading large JARs for CRC checks. Matching counts and byte totals do not prove cache equality or runtime compatibility.

## Run in Cloud Shell
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p143-emulator-cache-integrity
git worktree add --detach "$HOME/packtook-p143" origin/review/p143-emulator-cache-integrity
cd "$HOME/packtook-p143"
python3 audit/p143-emulator-cache-integrity.py
```

Only share output beginning `P143_`. Keep private recovered source and emulator logs in Cloud Shell. Emulators have not started successfully, so Owner security review remains blocked. **NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**
