# P170 — Independent Offline JWT Authentication Boundary Candidate

## Established evidence
P169 Cloud Shell completed read-only version inventory: Firebase CLI 15.34.2, Node.js v26.13.0, firebase-functions 6.6.0, firebase-admin 13.10.0 (preinstalled in pinned P168 worktree). P168 local Callable HTTP: both malformed tokens reached the generated Owner Analytics handlers, were denied HTTP 403 / PERMISSION_DENIED before any mock datastore read. This is **not** protocol-conformant 401 / UNAUTHENTICATED and **not** cryptographic verification attestation. See [Firebase Callable Protocol](https://firebase.google.com/docs/functions/callable-reference) and [Firebase Functions issue #1465](https://github.com/firebase/firebase-functions/issues/1465) for local emulator debug-mode limitation.

## P170 scope and isolation
- Pin exact reviewed backend source Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3` and visibility of the existing Owner claim guard. Never import `functions/index.js` or recovered Owner handlers.
- Generate fresh ephemeral RSA-2048 private/public keys in process memory **only**; do not write keys to filesystem or print them.
- Build deliberately independent Node built-in-crypto **test-only JWT verifier candidate**: strict header `RS256` and `kid`, RSA signature check, expected demo-project issuer and audience, subject, issued-at, expiry, optional not-before; post-authentication strictly require verified email and Boolean `packtookPlatformOwner === true`.
- Require HTTP 401 / UNAUTHENTICATED for bad signature, wrong issuer/audience, expired or malformed token; HTTP 403 / PERMISSION_DENIED for correctly signed but non-owner/otherwise unprivileged user; HTTP 200 for valid **synthetic** Owner.
- 18 synthetic positive/negative cases plus four fail-closed fixtures. No real credentials, network requests, Google services, Emulator calls, live accounts, IAM/claims writes, deployment or recovered source imports.

## Scope limitations (do not overclaim)
This does **not** execute `firebase-admin.auth().verifyIdToken()`, reproduce Google's public key / certificate rotation, revocation checking, or prove Firebase Functions HTTP runtime production behavior. It is an independently authored boundary demonstration only; it cannot close P168's invalid-token protocol FAIL or authorize deployment. In particular, production sign-in email verification and Owner custom claims must be verified through trusted Firebase Auth tokens, not client-supplied fields. JWT duplicate JSON properties, key-rotation and revocation handling are outside this candidate's coverage and must be assessed before any production design adoption.

## Cloud Shell offline test
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p170-offline-jwt-verification-boundary
if [ ! -d "$HOME/packtook-p170" ]; then
  git worktree add --detach "$HOME/packtook-p170" origin/review/p170-offline-jwt-verification-boundary
fi
cd "$HOME/packtook-p170"
node audit/p170-jwt-fixtures.js
node audit/p170-jwt-boundary.js
```

Expected `P170_OFFLINE_FIXTURES=4/4_PASS`, `P170_SYNTHETIC_JWT_CASES=18/18_PASS`, and `P170_DECISION=OFFLINE_JWT_BOUNDARY_CANDIDATE_PASS_PRODUCTION_NO_GO`.

**NO_GO_CALLABLE_HTTP_INCOMPLETE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**
