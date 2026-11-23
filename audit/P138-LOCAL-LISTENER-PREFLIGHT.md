# P138 — Local loopback listener probe

This step follows P137 clean demo-environment guard and checks only that two localhost ports respond to HTTP GET. It does NOT determine that the endpoints are authentic Firebase emulators, that the services are attached to the intended demo project, or that any recovered source may be imported. A malicious or unrelated local service could respond on those ports. Firebase Emulator operational readiness and test isolation still require separate inspection.

The script first executes P137 demo-only environment validation (no live credentials in the process, demo project ID, exact loopback addresses). It then sends GET requests only to 127.0.0.1:18080 and 127.0.0.1:19099, discards response bodies and prints only responder categories. It never executes recovered source, runs Cloud commands, or deploys.

## Run (safe; if no emulators are running it deliberately BLOCKS)

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p138-local-emulator-http-probe
git worktree add --detach "$HOME/packtook-p138" origin/review/p138-local-emulator-http-probe
cd "$HOME/packtook-p138"
bash audit/p138-local-listener-preflight.sh
```

Use this script only to check **already-running localhost listeners**. It does not start Firebase emulators and does not prove production is unreachable from Cloud Shell; do not import the recovered modules until manual initialization and authorization review is complete.

**NO_GO_DEPLOY** remains.
