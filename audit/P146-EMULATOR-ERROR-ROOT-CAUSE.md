# P146 — Offline explicit error taxonomy for existing P141 startup log

P145 config rules path was fixed and P145 offline tests passed, but the user reran the corrected P141 launcher and again hit `STARTUP_DEADLINE_EXCEEDED`. Therefore the config fix was **not sufficient**. P144 log analysis recorded 17 lines, explicit ERROR, Download Start but no Download Done, Java process or Ready. P143 confirmed cached JARs identical, valid and 138093843 bytes. We must diagnose the existing log without restarting again.

P146 checks error indicators (including HTTP 401/403/404/429/5xx, DNS, TLS, connect and timeout, Java startup, rules path, download failure, permission, port and project) and prints only line counts and categorical codes — **never** raw log text, file names, URLs or paths. It makes zero network calls and does not start emulators or import recovered Owner Functions. Pattern matches are evidence signals, not proof of root cause.

## Execute locally
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p146-firebase-emulator-error-root-cause
git worktree add --detach "$HOME/packtook-p146" origin/review/p146-firebase-emulator-error-root-cause
cd "$HOME/packtook-p146"
python3 audit/p146-emulator-error-taxonomy.py
```

Send only `P146_` flags to the review thread. Do not paste raw emulator log, recovered source or secrets. Do not restart P141 until an actionable failure cause is identified. Keep **NO_GO_OWNER_IMPORT / NO_GO_DEPLOY**.
