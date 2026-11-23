# P149 — Classify startup port availability errors in private Cloud Shell log

The real P147 operator output showed ERROR/CHECK/AVAILABLE tokens in two error lines, which raises a different hypothesis from downloading or Node26 compatibility: Firebase CLI checks whether emulator ports are available and can fail when binding addresses (particularly IPv6 localhost). This has **not been confirmed** in the user's private log.

P149 reads ONLY the existing P141 startup log and counts closed-list port availability patterns, EADDRNOTAVAIL/EADDRINUSE, IPv4/IPv6 loopback and startup stages. It prints no raw log, paths or URLs. It does not open ports, execute Firebase CLI, restart emulators, install Node or import recovered Owner source.

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p149-emulator-port-preflight-diagnosis
git worktree add --detach "$HOME/packtook-p149" origin/review/p149-emulator-port-preflight-diagnosis
cd "$HOME/packtook-p149"
python3 audit/p149-emulator-port-diagnostic.py
```

If it reports PORT_CHECK_ADDRESS_NOT_AVAILABLE, the next fix should focus on explicit IPv4 bindings and emulator port preflight behavior (not Node installation or cache resets). If absent, keep investigating without assuming port cause. No production/staging writes. **NO_GO_OWNER_IMPORT / NO_GO_DEPLOY**.
