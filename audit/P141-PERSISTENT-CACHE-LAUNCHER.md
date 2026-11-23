# P141 — Persistent private emulator cache and bounded startup

Operator diagnostic: existing cache 132 MB, disk available 2.5 GB, no running Firebase emulator or listener. P140 used a new temporary HOME every launch, potentially missing this cache; root cause not conclusively established.

P141 seeds only the Firebase emulator cache into a persistent private HOME. It uses a demo-only project, loopback ports, deny-all Firestore rules from P140, never imports recovered Owner source and never starts the Functions emulator.

Startup checks run for at most 90 seconds before P141 reports a block; if listeners become reachable the emulator remains in foreground until Ctrl+C. Logs are retained privately in the isolated HOME, not echoed. Do not paste raw logs or credentials.

## Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p141-persistent-demo-emulator-cache
git worktree add --detach "$HOME/packtook-p141" origin/review/p141-persistent-demo-emulator-cache
cd "$HOME/packtook-p141"
bash audit/p141-demo-emulator-start.sh --preflight
bash audit/p141-demo-emulator-start.sh
```

If both listeners respond, leave this tab open and rerun P138 in another. Listener reachability is not authenticated emulator identity or authorization proof. Never import recovered Owner code. NO_GO_DEPLOY remains.