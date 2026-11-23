# P155 — Official isolated Firestore Emulator setup, not startup

P154 actual Cloud Shell: firebase-tools 15.34.2 source contains literal JAR v1.22.0; isolated and ordinary cache only have v1.21.0; most recent startup log includes `Downloading` but no completion. This provides an actionable **version mismatch candidate**, not verified root cause.

Use Firebase's official CLI command `setup:emulators:firestore` once in the **existing isolated HOME**, without starting an emulator, creating any Firebase project, or loading recovered Owner functions. The command can access official Firebase emulator distribution infrastructure; no staging/production writes or deploy. Its output is captured in a private log and not printed. A bounded 180-second timeout returns nonzero if setup did not complete. The script validates cache JAR ZIP integrity and reports a version-1.22.0 boolean. Never rename an old JAR to a new version.

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p155-isolated-official-firestore-setup
if [ ! -d "$HOME/packtook-p155" ]; then
  git worktree add --detach "$HOME/packtook-p155" origin/review/p155-isolated-official-firestore-setup
fi
cd "$HOME/packtook-p155"
bash audit/p155-official-download-only.sh --download-only
```

Only share `P155_` lines. If the JAR integrity check passes, the next stage is one bounded demo-only startup and **explicit identity attestation** of Auth/Firestore, not an Owner import. If download still stalls, diagnose official provider/network connectivity through sanitized error types before retrying.

NO_GO_OWNER_IMPORT / NO_GO_DEPLOY remains.
