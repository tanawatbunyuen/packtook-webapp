# P137 — Emulators-only environment preflight (no handler import)

P136 operator run verified all six quarantined files and four Owner exports; 3 JS parsed without errors, but observed 54 top-level call candidates, 3 Firebase Admin initialization indicators, 3 secret declaration calls and 8 environment references. Import remains **NO_GO**.

P137 **only validates a sanitized environment**, with project `demo-packtook-owner-security` and local-only emulator endpoints. It does not start emulators, connect to services, import source or create Firestore documents. It denies any live project context, ADC/service credentials supplied via known environment variables, Firebase config, missing host settings or non-loopback host settings. It cannot rule out credentials obtainable from Cloud Shell or metadata services; an isolated sandbox with no host access and restricted network is required before importing untrusted source.

## Run safe environment preflight
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p137-emulator-isolation-preflight
git worktree add --detach "$HOME/packtook-p137" origin/review/p137-emulator-isolation-preflight
cd "$HOME/packtook-p137"
bash audit/p137-isolation-preflight.sh
```

`P137_DECISION=ENV_ISOLATION_PREFLIGHT_PASS_NOT_RUNTIME_PROOF` only means the clean process environment matches expected demo-only settings. It does **not** prove emulators are running, real handler import is safe, credentials cannot be reached, or Owner authorization has passed.

### Non-negotiable next gates

- Review recovered module initializers and dependencies (P136) offline; don't execute them yet.
- Make a truly isolated emulator runtime with no Cloud Shell ADC / metadata / network access to live services.
- Confirm real Firestore/Auth emulators run only against a `demo-` project, and all test fixtures are synthetic.
- Build authz, multi-tenant, idempotency, credit and expiry behavior tests, including no-write assertions for every unauthorized caller.
- Keep original Owner Functions and **NO_GO_DEPLOY** until verified.

All P137 GitHub CI tests are synthetic and contain no recovered source.
