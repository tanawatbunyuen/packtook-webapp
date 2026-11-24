# P169 — Emulator Auth Boundary and Dependency Version Provenance

## Operator evidence from P168

The user executed the local demo P168 with two reviewed Owner Analytics handler bodies and a fake read-count datastore. Both malformed-token cases yielded **HTTP 403 / PERMISSION_DENIED**, **HANDLER_ENTERED=TRUE**, and **DB_READS_UNCHANGED=TRUE**. All other 16 callable cases passed, disposable local Auth accounts were deleted, and the emulator was shut down. Real production functions were not accessed.

That establishes **local deny-before-mock-read**; it does **not** establish cryptographic verification of the provided token or compliant invalid-token response. [Firebase Callable Protocol](https://firebase.google.com/docs/functions/callable-reference) describes 401 / UNAUTHENTICATED for invalid authentication tokens. Firebase Functions [upstream issue #1465](https://github.com/firebase/firebase-functions/issues/1465) describes the Auth Emulator debug-mode token verification behavior; this is a plausible explanation, not a substitute for version-specific/runtime evidence.

## P169 scope

`audit/p169-auth-boundary-inventory.py` verifies the pinned reviewed `functions/index.js` blob and P168 diagnostic fields, then reads **local** versions from `firebase --version`, `node --version`, and existing Node resolution of `firebase-functions` and `firebase-admin` in `functions/node_modules`. It does not start emulators, import or execute Backend Functions, install dependencies, connect to Google services, issue tokens, set claims, or print sensitive filesystem paths or logs.

The recorded user-observed P168 results are explicitly labelled `OPERATOR_OBSERVED`, not newly tested. A success means the **version inventory ran and security/protocol findings were classified**, not that the protocol has passed.

## Run in Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p169-emulator-auth-boundary-provenance
if [ ! -d "$HOME/packtook-p169" ]; then
  git worktree add --detach "$HOME/packtook-p169" origin/review/p169-emulator-auth-boundary-provenance
fi
cd "$HOME/packtook-p169"
python3 audit/p169-boundary-fixtures.py
python3 audit/p169-auth-boundary-inventory.py
```

Expected `P169_OFFLINE_FIXTURES=4/4_PASS`, local version fields (possibly UNAVAILABLE), `P169_OPERATOR_OBSERVED_INVALID_TOKEN_SECURITY_DENIED=PASS`, `P169_OPERATOR_OBSERVED_INVALID_TOKEN_PROTOCOL_CONFORMANT=FALSE`, and `P169_DECISION=EMULATOR_AUTH_BOUNDARY_REVIEWED_PROTOCOL_NO_GO`.

## Release constraints

No original `firestore.rules` correction has been merged/deployed. No deployed Functions revision, IAM, App Check, OAuth/JWT signature verification, real datastore tenant isolation, four recovered Owner Functions, billing/provider readiness, or owner approvals are attested. A local emulator's permissive JWT parsing/verification must **never** be treated as proof that a production callable enforces cryptographic signature validation. Review protocol correctness in an isolated production-equivalent validator only after independent change control, without touching live credentials or customers.

**NO_GO_CALLABLE_HTTP_INCOMPLETE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**
