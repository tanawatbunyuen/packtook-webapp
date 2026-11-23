# P136 — Recovered Owner module pre-import static guard

P128 private recovery has six files with SHA256 matching the staging build ZIP. P131–P134 static audits identify Owner callables and mutation calls but **authorization is not proven**. P135 blocks deployment and provides emulator-only test contract.

**Purpose:** before importing any recovered code into an emulator, inventory top-level initialization and dependency indicators from validated files, without running or printing source. Output is aggregate counts only.

The analyzer reports whether the recovered code has parse errors, top-level calls, `require` calls, `initializeApp`/secret setup, `process.env` references, `eval`/dynamic Function usage and Owner exports. Even zero top-level calls **does not guarantee** import safety: dynamic loaders, getters, dependency side effects and module resolution are outside this scope.

## Run in authorized Cloud Shell, separate HOME worktree

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p136-recovered-entrypoint-side-effect-preflight
git worktree add --detach "$HOME/packtook-p136" origin/review/p136-recovered-entrypoint-side-effect-preflight
cd "$HOME/packtook-p136"
NODE_PATH="$HOME/.packtook-audit-tools/node_modules" node audit/p136-recovered-module-preimport.cjs
```

No Cloud API calls, no recovered code execution, no source uploads and no production/staging changes.

## Hard gates before executing recovered handlers in emulator

1. Verify initialization has no external network/production target, untrusted dependency post-install scripts or dangerous environment side effects
2. Ensure emulator-only project ID beginning `demo-`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, and no live credentials
3. Independently review server-side Owner authorization, customer tenancy and credits/expiry invariants; define expected responses for unauthorized callers
4. Only then create and run an isolated real-handler emulator test harness with mock identities and synthetic customer accounts

A green CI result means offline tests passed, **not** that recovered code may be imported or deployed. **NO_GO_DEPLOY** remains.
