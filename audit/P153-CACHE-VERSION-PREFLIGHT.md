# P153 — Static Firestore JAR cache version preflight

Latest actual P152 startup (90-second timeout) produced a nine-line log with zero errors, no ready, one Firestore-start mention, no Auth-start or Java mention, and one download mention. This is NOT proof the download hung: it might be a reminder line or a stalled download. Official Firebase docs confirm emulator JARs are cached under `~/.cache/firebase/emulators/` and CLI updates can require a new binary.

P153 inspects only local filenames and a small fixed set of static firebase-tools source filenames (without importing code). It compares the versions of existing Firestore JARs in normal and isolated HOME cache, and counts download-start/completion lines in the private log. It emits no arbitrary log lines, URLs, paths or credentials. A literal expected JAR version may NOT appear in the CLI source files; `NOT_EMBEDDED_OR_UNKNOWN` explicitly means that version matching remains inconclusive. There are no restarts, installs, cloud queries, source imports, or deployments.

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p153-firestore-cache-version-preflight
git worktree add --detach "$HOME/packtook-p153" origin/review/p153-firestore-cache-version-preflight
cd "$HOME/packtook-p153"
python3 audit/p153-cache-version-preflight.py
```

Share only `P153_` lines. If version missing is confirmed, propose a narrowly controlled official binary installation, not arbitrary archive copying or running recovered Owner functions. Otherwise investigate CLI pre-Java startup stages. NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
