# P171 — Firebase Admin SDK verifyIdToken Local Auth Emulator Review

## Purpose
P170 Cloud Shell verified 18/18 synthetic JWT cases with an **independent** Node crypto verifier, not Firebase Admin. P168 on Firebase Functions Emulator showed both invalid malformed-token requests reached Handler and were denied 403 before mock datastore access. P169 recorded local Firebase CLI 15.34.2, Node 26.13.0, Functions SDK 6.6.0, Admin SDK 13.10.0. No production token verification has yet been attested.

P171 invokes the **actual installed `firebase-admin.auth().verifyIdToken()`** against a token minted in a strictly isolated LOCAL Auth Emulator. It does NOT import `functions/index.js` or recovered Owner handlers. Test uses a disposable synthetic `@example.invalid` account with `packtookPlatformOwner:false`, generates a local ID token, then classifies:
- a valid Auth Emulator token (expected accepted)
- an obviously malformed token (expected rejected)
- a modified signature (outcome recorded, **not** called cryptographic attestation in emulator)
- a changed audience without re-signing (outcome recorded, **not** production attestation)

**Important:** Auth Emulator mode may intentionally bypass signature verification. A tampered token accepted in the Emulator is not proof of a production vulnerability, and a tampered token rejected in the Emulator is not proof that production verifies signatures. This test cannot resolve P168's HTTP 403 vs required 401 protocol gap.

The launcher uses a hash-pinned Backend source (`92262ea2fbbb941188937d72f0eea74a735d2bf3`), a temporary config with **only Auth Emulator** on loopback 127.0.0.1:19371, no Functions or Firestore Emulator, pinned installed SDK from user's previously tested `$HOME/packtook-p168/functions`, sanitized subprocess environment, and demo project `demo-packtook-p171-admin-token`. No dependency installation, no cloud credentials, no real users; synthetic account deleted in `finally`; emulator process group stopped and temporary config deleted.

GitHub Actions runs *offline fixtures only*. Real local Admin SDK verification must be separately run by operator. No token, password, key or raw request body is printed.

## Cloud Shell run
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p171-admin-sdk-token-verification-emulator
if [ ! -d "$HOME/packtook-p171" ]; then
  git worktree add --detach "$HOME/packtook-p171" origin/review/p171-admin-sdk-token-verification-emulator
fi
cd "$HOME/packtook-p171"
node audit/p171-admin-fixtures.js
python3 audit/p171-local-auth-emulator.py
```

Expected `P171_OFFLINE_FIXTURES=4/4_PASS`, `P171_AUTH_EMULATOR_READY=PASS`, `P171_LOCAL_TOKEN_ISSUED=PASS`, `P171_ADMIN_VERIFY_LOCAL_VALID=ACCEPTED`, `P171_ADMIN_VERIFY_MALFORMED=REJECTED`, `P171_DISPOSABLE_USER_CLEANUP=PASS`. Actual modified-token results must be recorded honestly.

**No-go:** P171 is not a real Google-signed JWT test, production deployed Functions attestation, signature verification at production boundary, App Check/IAM, or permission to import recovered Owner code. `NO_GO_CALLABLE_HTTP_INCOMPLETE`, `NO_GO_OWNER_IMPORT`, `NO_GO_DEPLOY` remain.

## P171 operator runtime follow-up: legitimate local token rejection

Cloud Shell observed Auth Emulator ready, Admin SDK 13.10.0 loaded, synthetic account created, local ID token issued, but **`P171_ADMIN_VERIFY_LOCAL_VALID=REJECTED`**. No Owner authentication attestation followed. All synthetic resources were cleaned.

Code review found a harness bug: account creation used the named `admin.auth(app)` service but `inspect()` called `admin.auth().verifyIdToken(token)` on the default, uninitialized Admin app. The error was caught and incorrectly flattened to `REJECTED`. This is a test-harness issue, not evidence Firebase Auth rejected a legitimate token cryptographically.

The updated review candidate passes the explicitly named `auth` service into `inspect()` for all four cases, and adds a static regression fixture guarding against use of the default Admin app. Local runtime still needs operator re-execution before claiming PASS. Do not print tokens or raw exception messages; preserve NO_GO gates.
