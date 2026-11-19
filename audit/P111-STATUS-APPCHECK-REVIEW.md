# P111 — Status App Check isolated remediation candidate

Scope: `review/p111-status-appcheck-candidate` only. This is **not deployed**.

## Change
- Shared `options` remain unchanged for all legacy callables.
- New `statusOptions={...options,enforceAppCheck:true}`.
- Only `usageStatus` and `recordingStatus` use `statusOptions`.
- The existing `uid(req)` guard still requires Firebase Auth and verified email.
- No changes to quota, recordings, billing, payment, Firestore rules, or production configuration.

## Offline validation
```sh
node --check functions/index.js
node audit/p111-status-appcheck-candidate.test.cjs
```

P110 is a **historical baseline check** designed to fail while App Check is missing from shared options, and should not be used as the acceptance test of this status-only approach. Use the P111 test.

## Staging go/no-go (NOT EXECUTED)
1. Verify the target callable source revision and codebase ownership for *both* functions in `packtook-staging`. Avoid unlabeled codebase deployments and replacement of unrelated functions.
2. Ensure Firebase Web App Check client obtains reCAPTCHA Enterprise tokens and initializes before first callable request. Consider token expiry, local test flows, and authorized test users.
3. With staging-only accounts: missing Auth => reject; unverified email => reject; valid Auth but missing/invalid App Check => reject; valid Auth + valid App Check => allow relevant owned resources; cross-user recordingId => not-found.
4. Confirm the same tests with `usageStatus`; check no unintended legacy-callable deployment changes.
5. Capture runtime logs, deployment revision, reviewer/owner approval, and rollback path before any staging rollout.
6. Keep public signup closed and production untouched. This branch is not approved to deploy automatically.

## Security notes
Static inspection cannot prove the deployed revision, token issuance, runtime enforcement, CI green status, or browser compatibility. Firebase App Check rejection is performed by the callable transport; the handler still checks Auth. Do not emulate or bypass App Check on real staging requests.
