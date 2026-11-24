# P168 — Isolated DEMO Firebase Callable HTTP Runtime (candidate)

## Isolation and permitted operations

P167 Cloud Shell passed 4/4 source fixtures, 12/12 denied-before-mock-read scenarios and 2/2 synthetic valid Owner scenarios. Those tests directly invoked extracted handler bodies; they did **not** attest Firebase Callable HTTP.

P168 constructs a **new transient DEMO-only Functions source directory** containing only the exact hash-pinned `uid(req)` and `requirePlatformOwner(req)` functions and the full reviewed `ownerAnalyticsSummary` and `ownerAnalyticsCustomers` handlers extracted from `functions/index.js` (Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3`). The full backend is **never imported**; four recovered Owner functions are never imported. All datastore Admin SDK calls are replaced with an instrumented, empty in-memory mock that records only read counts. `firebase-functions/v2/https` runs through installed official Firebase SDK, and Auth/Functions Emulators are started locally using demo project `demo-packtook-owner-http-p168` on localhost ports hub 14600, Auth 19299, Functions 15081, logging 14610. No Firestore emulator/data or real customers.

During real local execution, P168 creates only synthetic `@example.invalid` accounts in the **local Auth Emulator**, grants synthetic claims via Firebase Admin SDK configured for the local Auth Emulator, logs them in via local REST, and deletes created users in finally. It invokes the two actual emulated `onCall` HTTP endpoints using locally minted tokens. Required denied scenarios: signed out, invalid token, unverified email, customer admin, missing Owner claim, false Owner claim, string Owner claim, forged payload. For each, authorization must fail and **mock privileged datastore reads must remain unchanged**. A valid synthetic Owner must reach only the empty stub datastore and return an empty result. Unexpected calls, nonstandard errors or any real data read fail closed.

P168 does **not** install packages automatically. It checks for pre-existing `firebase-functions` and `firebase-admin` dependencies in `functions/node_modules`. If missing, it emits `P168_BLOCK=PREINSTALLED_FUNCTIONS_DEPS_MISSING` and stops for manual dependency preparation. The existing `functions/package.json` has NO lockfile in the reviewed source; dependency installation must be separately reviewed. All generated runtime files and transient accounts are local only. Emulator logs are private and never printed verbatim.

## Local Cloud Shell run

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p168-isolated-callable-http-runtime
if [ ! -d "$HOME/packtook-p168" ]; then
  git worktree add --detach "$HOME/packtook-p168" origin/review/p168-isolated-callable-http-runtime
fi
cd "$HOME/packtook-p168"
python3 audit/p168-preflight-fixtures.py
python3 audit/p168-callable-http.py
```

**GitHub CI runs only offline preflight**, not real Firebase Functions Emulator. Real P168 result requires the user's Cloud Shell.

Expected: `P168_PINNED_SOURCE_AND_TWO_HANDLER_ONLY=PASS`, `P168_PREINSTALLED_FUNCTIONS_SDK=PASS`, `P168_ISOLATED_CALLABLE_HTTP_READY=PASS`, signed-out/invalid-claim denials, positive synthetic Owner calls, `P168_DISPOSABLE_AUTH_CLEANUP=PASS`, `P168_DECISION=ISOLATED_CALLABLE_HTTP_GATES_ATTESTED_PRODUCTION_NO_GO`.

**Caveats:** test-only empty datastore and exact source snippets with synthetic module configuration; does not prove real deployed function revision, real Backend Admin SDK tenant isolation, App Check enforcement, IAM, production deployed rules, or recovered Owner source provenance. `ownerOptions.enforceAppCheck` is explicitly disabled in the DEMO-only generated functions to avoid confusing this test with App Check attestation. Do NOT merge or deploy this harness.

**NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**
