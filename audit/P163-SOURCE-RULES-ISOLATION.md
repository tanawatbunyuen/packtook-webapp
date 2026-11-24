# P163 — Source Firestore Rules account isolation in a separate demo emulator

Source evidence on the reviewed GitHub branch:
- `firebase.json` references root `firestore.rules`.
- `firestore.rules` Git blob `d3e43720eb079c7f0fec50ec7f4e622fd7316e4a` limits client reads to own UID at `accounts/{id}`, `accounts/{id}/recordings/{rid}`, and `accounts/{id}/audit/{eventId}` and denies client writes for these paths.
- **Repository rules are not the same as attested currently deployed production rules.**

The real P163 operator run twice failed `P163_ISOLATED_REGISTRY=FAIL`. The operator's redacted local-log classification found `RULES_ERROR=DETECTED` and `PROCESS_EXIT=DETECTED`, but did not reveal an exact parser error. Source inspection found `function signedIn(){return request.auth != null}` without the semicolon required after the return expression. **Hypothesis**, not proven root cause: this syntax issue prevented Firestore startup. P163 was updated to run only against an isolated syntax-normalized file and validate that its bytes equal the original reviewed blob plus exactly one semicolon. This validates the *candidate*, not the original rules as-is. No production/source rules mutation or deployment.

This P163 script:
1. Fails closed if exact reviewed repository source Git blob or isolated emulator config differs, or if separate ports are occupied.
2. Starts **another local Auth/Firestore demo emulator** (`demo-packtook-owner-security-p163`) using an **isolated copy** `audit/p163-source-rules-normalized.rules`, derived from `firestore.rules` with exactly one added semicolon terminating the helper function `return` statement; root `firestore.rules` remains unchanged, **not** P140 deny-all fixture; separate loopback ports Hub 14500, Firestore 18180, Auth 19199, Logging 14510, Firestore auxiliary WebSocket 9151 (instead of default 9150 used by P141).
3. Uses verified private Firebase emulator cache (P160) but never starts Functions or connects to staging/production services.
4. Creates two random local-only `@example.invalid` accounts with Auth Emulator, signs them in, and tests **three paths** using Firestore REST GET: own account => 404 (nonexistent but authorized), other account => 403, anonymous => 403. No Firestore documents are created. Requires all 18 reads to match expected matrix.
5. Deletes local Auth fixtures in a finally block and terminates **only its own** isolated emulator process. Prints status markers only; no tokens, account IDs, emails, response bodies or raw logs. Logs remain in the private HOME. The initial P163 Cloud Shell run failed at registry readiness; a likely reason was both local emulators reserving Firestore WebSocket port 9150. This revision isolates P163 on port 9151. The exact cause of the first failure remains unconfirmed without private log inspection.
6. Denial for unknown paths and Firestore client writes can be added as *additional* tests, but this candidate never attempts Firestore writes. SDK rules parity and production deployment remain separate gates.

For Cloud Shell from your existing repo worktree (leave old P141 emulator alone):
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p163-isolated-source-rules-account-isolation
if [ ! -d "$HOME/packtook-p163" ]; then
  git worktree add --detach "$HOME/packtook-p163" origin/review/p163-isolated-source-rules-account-isolation
fi
cd "$HOME/packtook-p163"
python3 audit/p163-source-rules-isolation.py
```

Expected: `P163_SOURCE_RULES_GIT_BLOB_MATCH=PASS`, `P163_ISOLATED_REGISTRY=PASS`, each of the 18 identity/path checks PASS, `P163_DISPOSABLE_AUTH_CLEANUP=PASS`, `P163_DECISION=SOURCE_RULES_ACCOUNT_ISOLATION_ATTESTED`, and `P163_EMULATOR_PROCESS_STOPPED=TRUE`.

CI tests are synthetic and **cannot** attest Cloud Shell local Emulator behavior. Real P163 only tests committed source rules in a demo emulator, **not** production deployment or Owner callable authorization.

NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
