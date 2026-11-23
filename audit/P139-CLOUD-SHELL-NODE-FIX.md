# P139 — Cloud Shell Node resolution fix

Operator P137 failed with `env: 'node': No such file or directory`. Root cause: `env -i PATH=/usr/local/bin:/usr/bin:/bin node ...` discarded the Cloud Shell (often nvm-managed) Node directory. This is an **environment launcher bug**, not evidence of a problem in recovered source.

The P137 and P138 launcher scripts now resolve `command -v node` to an **absolute executable path before environment sanitization** and then invoke that exact executable under `env -i`. A missing/non-executable Node binary causes `P139_BLOCK=NODE_BINARY_NOT_FOUND` and no import or Cloud action. Clean demo-project isolation checks still run in P137.

## Run in Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p139-cloud-shell-node-path-fix
git worktree add --detach "$HOME/packtook-p139" origin/review/p139-cloud-shell-node-path-fix
cd "$HOME/packtook-p139"
bash audit/p137-isolation-preflight.sh
```

P138 can run separately with `bash audit/p138-local-listener-preflight.sh` **only after** local test listeners are intentionally running. A failed P138 connection is expected when no emulator is running. HTTP liveness is not Firebase emulator identity, nor security proof.

P139 does not authorize importing recovered Owner Functions, executing recovered module code, or deploying. **NO_GO_DEPLOY** remains.
