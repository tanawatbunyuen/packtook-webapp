# Multiuser integrated callable LOCAL emulator smoke (candidate)

Created 2026-11-28. Source branch: `feature/fast-track-multiuser-integrated-slice`.

**Status: NEW, NOT OPERATOR-RUN.** The user has confirmed previous static gates 14/14 and 30/30 PASS. This new probe runs actual Functions Emulator HTTP callable wrappers (not a mock), but tests **unauthenticated, App Check-absent requests only**. It cannot establish positive authentication, operator isolation or valid App Check enforcement.

Artifacts:
- `firebase.emulator-fast-track.json`: localhost-only Functions, Firestore and Auth emulator configuration, with UI disabled.
- `audit/fast-track-full-public/multiuser-integrated-callable-emulator-smoke.cjs`: fail-closed demo project ID + three local emulator host environment variables before any request; sends minimal callable envelopes against 14 v2 callable endpoints on `127.0.0.1:5001`, expects 400/401/403 for every unauthenticated request. Any 200/404/500 is treated as a FAIL. No requests to external URLs, no Firestore writes.

Operator can run via **child shell** after installing `functions` dependencies in a detached worktree (Node 22 runtime preferred; Node 26 may show EBADENGINE warning). Use `firebase emulators:exec --config firebase.emulator-fast-track.json --only auth,firestore,functions --project demo-packtook-integrated-01 'node audit/fast-track-full-public/multiuser-integrated-callable-emulator-smoke.cjs'`.

Blockers:
1. Full `functions/index.js` load in Functions Emulator may reveal startup errors or unavailable secrets; do not silence them or bypass auth/App Check to make tests pass. Use local test-only fixtures when needed; never read or update real Secret Manager.
2. Callable OPTIONS/CORS, authentication and App Check wrappers need positive/negative end-to-end coverage. HTTP 401/403 without tokens does not prove valid tokens are checked in production.
3. Sixteen additional callables not included in this first 14-endpoint negative smoke; all 30 need full endpoint coverage.
4. Existing Omise settings remain test-only; billing/tenant data migration not ready.
5. Do not merge or deploy. **GATE B3 OPEN; FULL_PUBLIC=NO_GO.**
