# P168 — Isolated DEMO Firebase Callable HTTP Runtime (candidate)

## Isolation and permitted operations

P167 Cloud Shell passed 4/4 source fixtures, 12/12 denied-before-mock-read scenarios and 2/2 synthetic valid Owner scenarios. Those tests directly invoked extracted handler bodies; they did **not** attest Firebase Callable HTTP.

P168 constructs a **new transient DEMO-only Functions source directory** containing only the exact hash-pinned `uid(req)` and `requirePlatformOwner(req)` functions and the full reviewed `ownerAnalyticsSummary` and `ownerAnalyticsCustomers` handlers extracted from `functions/index.js` (Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3`). The full backend is **never imported**; four recovered Owner functions are never imported. All datastore Admin SDK calls are replaced with an instrumented, empty in-memory mock that records only read counts. `firebase-functions/v2/https` runs through installed official Firebase SDK, and Auth/Functions Emulators are started locally using demo project `demo-packtook-owner-http-p168` on localhost ports hub 14600, Auth 19299, Functions 15081, logging 14610. No Firestore emulator/data or real customers.

During real local execution, P168 creates only synthetic `@example.invalid` accounts in the **local Auth Emulator**, grants synthetic claims via Firebase Admin SDK configured for the local Auth Emulator, logs them in via local REST, and deletes created users in finally. It invokes the two actual emulated `onCall` HTTP endpoints using locally minted tokens. Required denied scenarios: signed out, invalid token, unverified email, customer admin, missing Owner claim, false Owner claim, string Owner claim, forged payload. For each, authorization must fail and **mock privileged datastore reads must remain unchanged**. A valid synthetic Owner must reach only the empty stub datastore and return an empty result. Unexpected calls, nonstandard errors or any real data read fail closed.

P168 does **not** install packages automatically. It checks for pre-existing `firebase-functions` and `firebase-admin` dependencies in `functions/node_modules`, then creates a temporary local symlink to those preinstalled packages for Firebase Functions CLI SDK detection; no package installation or module upgrade occurs. If user creation partially fails, the harness attempts an immediate local-only rollback. If missing, it emits `P168_BLOCK=PREINSTALLED_FUNCTIONS_DEPS_MISSING` and stops for manual dependency preparation. The existing `functions/package.json` has NO lockfile in the reviewed source; dependency installation must be separately reviewed. All generated runtime files and transient accounts are local only. Emulator logs are private and never printed verbatim.

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

## Observed real Cloud Shell P168 invalid-token discrepancy (2026-11-24)

The first real P168 invocation launched Functions/Auth emulators and verified synthetic Auth accounts. It passed **16/18** callable scenarios, with both `INVALID_TOKEN` tests returning **HTTP 403 / PERMISSION_DENIED**, not the expected **HTTP 401 / UNAUTHENTICATED**. In both cases, `P168_..._INVALID_TOKEN_DB_READS_UNCHANGED=TRUE`, confirming the in-memory mock datastore was not read. All other denials and valid synthetic Owner empty-data responses passed. Account cleanup and isolated process shutdown passed. This is **secure denial within this test scope**, but **NOT Callable protocol conformance**, and P168 remains `NO_GO_CALLABLE_HTTP_INCOMPLETE`.

The candidate adds allowlisted (non-token, non-log) diagnostics showing `INVALID_TOKEN_SECURITY_DENIED`, `INVALID_TOKEN_PROTOCOL_CONFORMANT`, and `INVALID_TOKEN_HANDLER_ENTERED`. A test-only `HANDLER` marker is inserted at the start of each generated local Callable handler, independent of the `READ` marker; the two original source snippets in Git remain unchanged. **If the malformed token reaches the handler despite protocol requiring 401, do not mark protocol conformance PASS merely because the owner claim guard rejects it.** If the emulator returns 403 before reaching the handler, treat it as potential Emulator/SDK protocol-version behavior requiring separate review.

Official Firebase callable protocol: https://firebase.google.com/docs/functions/callable-reference (invalid supplied Auth token is specified as HTTP 401 / UNAUTHENTICATED). Review SDK and emulator exact versions before drawing a production conclusion. No deployment is authorized.

## P168 investigation: HTTP 403 after handler entry (2026-11-24)

A second real Cloud Shell run showed **both** malformed-token requests entering the synthetic HTTP Callable handler (`HANDLER_ENTERED=TRUE`) and being denied by `requirePlatformOwner` with HTTP 403 / `PERMISSION_DENIED`. Instrumented mock data reads remained unchanged. This establishes that the request did not get rejected before the handler by the *local emulator*; it does not prove the token was authenticated or cryptographically verified.

**Relevant upstream explanation:** Firebase Functions maintainer [confirmed in firebase-functions issue #1465](https://github.com/firebase/firebase-functions/issues/1465#issuecomment-1749844678) that the local Firebase Emulator may run with debug behavior that bypasses token verification to enable offline testing. The report was closed as working as intended in October 2023. Version-specific behavior remains to be confirmed on the operator's installed SDK and CLI. [Firebase Callable protocol](https://firebase.google.com/docs/functions/callable-reference) still requires invalid Auth tokens to be rejected with HTTP 401 / `UNAUTHENTICATED`; do **not** weaken or overwrite that production conformance expectation.

**Conclusion:** The 403/handler-entry discrepancy is consistent with local debug-mode bypass but cannot be treated as full token-verification attestation. The Owner guard denied the token *in this observed case*, not all possible malformed or forged tokens. Do not infer full Owner security or run forged Owner JWTs to produce misleading emulator authorization results. Two separately tracked gates must remain distinct:

- Local **Owner claim guard** exercised via emulator: 16/18 cases met the original strict expectations, and both malformed-token cases were denied before any mock datastore reads.
- **Callable invalid-token protocol**: 0/2 strict cases passed (403 rather than 401); not attested by this Emulator run, requires separate version-controlled production-equivalent evidence.

Preserve `P168_DECISION=NO_GO_CALLABLE_HTTP_INCOMPLETE` until a separately approved test can establish protocol conformance. No Firebase Cloud/Production tests or deployments are permitted by this review.
