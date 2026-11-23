# P154 — Inspect installed Firebase CLI emulator source statically

Actual P153 Cloud Shell reports matching source/private cache JAR v1.21.0, but a nine-line log has one explicit Downloading line and zero download-finished lines, no Java, Auth, or Ready. The CLI's expected Firestore version remains unknown, so do **not** assume cached 1.21.0 is current.

P154 searches installed firebase-tools metadata and bounded emulator source files for **literal** Firestore JAR filenames and nearby versions. This is a heuristic. Versions near the word Firestore may not be expected JAR versions; distinguish `CLI_LITERAL_JAR_VERSIONS` from `CLI_FIRESTORE_NEARBY_VERSIONS`. A missing literal does not prove absence of a version. No CLI execution, download, network, restart, or recovered Owner code import.

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p154-firestore-cli-manifest-preflight
git worktree add --detach "$HOME/packtook-p154" origin/review/p154-firestore-cli-manifest-preflight
cd "$HOME/packtook-p154"
python3 audit/p154-cli-manifest-preflight.py
```

Send only `P154_` lines. Keep `NO_GO_OWNER_IMPORT` and `NO_GO_DEPLOY`.
