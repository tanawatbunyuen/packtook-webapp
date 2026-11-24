# P173 — Root Firestore Rules One-Character Syntax Correction

**Candidate only: NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**

## Narrow change
The original root `firestore.rules` (Git blob `d3e43720eb079c7f0fec50ec7f4e622fd7316e4a`) lacked the semicolon terminating `return request.auth != null` in `signedIn()`. P173 changes exactly **one byte**: adds `;` after `null`, resulting Git blob `52e207280059e5700da77add9e4af45971c94557`.

The corrected root file is **byte-for-byte identical** to `audit/p163-source-rules-normalized.rules`, which was the isolated normalized candidate used for the previously reported P163/P164 local tests. No allow-read, allow-write, path, nested match or Owner Authorization semantics are intentionally changed.

`firebase.json` references the root `firestore.rules`. P172's original source pin remains as historical provenance in `audit/p172-release-evidence.json`. The inherited P172 checker is extended to accept exactly this one-byte root candidate while reconstructing and checking the historical SHA; all eight P172 release gates remain explicitly NO_GO.

## Required verification
- GitHub CI: static exact byte patch equivalence, deny-write rules, nested account path read policies, P172 historical provenance and all release gates still NO_GO.
- **Cloud Shell required:** use isolated Auth/Firestore Emulator demo project, config `audit/p173-emulator-root-rules.json` referencing **the actual root** `../firestore.rules`. The script refuses changed pins and occupied ports. Test 2 disposable local users; owner missing documents => 404, other account => 403, unauthenticated => 403, client REST commit => 403, across account, recordings and audit paths.
- CI does **not** start the Emulator and cannot prove the real local 24 requests pass. Report `P173_REAL_EMULATOR_CASES=24/24_PASS` only after operator Cloud Shell run.
- No real customer documents, no valid production account, no Google Cloud or production/staging deployment. No recovered Owner code import.

### Cloud Shell
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p173-root-firestore-rules-syntax-regression
if [ ! -d "$HOME/packtook-p173" ]; then
  git worktree add --detach "$HOME/packtook-p173" origin/review/p173-root-firestore-rules-syntax-regression
fi
cd "$HOME/packtook-p173"
node audit/p173-root-rules-fixtures.js
node audit/p172-release-fixtures.js
node audit/p172-release-gates.js
python3 audit/p173-emulator-root-rules.py
```

Expected offline `P173_OFFLINE_FIXTURES=5/5_PASS`, `P172_RELEASE_GATES=8/8_NO_GO`; real Emulator `P173_REAL_EMULATOR_CASES=24/24_PASS`. If Emulator outputs a BLOCK, preserve NO_GO and investigate; never alter pass criteria to match failures.

**Production rules not attested. Changes remain in a Draft PR; do not merge or deploy.**

## P173 operator runtime follow-up — readiness classification (2026-11-24)

The operator ran the original P173 Cloud Shell test: offline fixtures 5/5 PASS; P172 preservation gates PASS; local runner returned `P173_BLOCK=EMULATOR_NOT_READY` and stopped without running any of the 24 runtime read/write cases.

Investigation identified a likely local **harness readiness logic bug**: the script demanded an extra `hub` registration in the hub's `GET /emulators` response. That endpoint enumerates registered emulators (Auth and Firestore); its own hub is not necessarily represented. Candidate fix limits the readiness check to registered Auth and Firestore, and adds safe, categorical process/hub status outputs if startup still fails (no raw logs or credentials).

Expected offline fixtures now `P173_OFFLINE_FIXTURES=6/6_PASS`. This does not prove the emulator has started; rerun separately in Cloud Shell. The 24-case real emulator gate remains unverified until a complete operator PASS. No production rules or release approvals change.

## P173 second Cloud Shell outcome: Firebase CLI process exited

At commit `c42f40c`, static P173 6/6 and P172 NO_GO checks passed. Runtime emitted `P173_EMULATOR_PROCESS=EXITED` and `P173_HUB_HTTP_STATUS=0`, before any Auth/Firestore security case. This disproves an exclusively hub-self-registration readiness bug: the local Firebase process exits before readiness. The actual exit cause is **unconfirmed**, and NO_GO remains.

P173 now emits only a fixed, non-secret `P173_EMULATOR_EXIT_CATEGORY` based on patterns in the **local** emulator log and `P173_EMULATOR_EXIT_CODE_CLASS` (ZERO/NONZERO). It does not print log contents, credential values, file paths, tokens or secrets. This differentiates CLI option, configuration/rules path, permission, Java, binary download and port errors without exposing underlying logs. If `UNCLASSIFIED_REVIEW_PRIVATE_LOG`, do not assume any cause; use a focused read-only follow-up.

Run the usual Cloud Shell `git fetch`, checkout the updated review branch, `node audit/p173-root-rules-fixtures.js`, and `python3 audit/p173-emulator-root-rules.py`. Expected offline fixtures now `7/7`. The 24-case runtime gate remains **unverified** until separately observed passing.

## P173 third operator outcome — nonzero CLI exit, unclassified

Cloud Shell at commit `1eac182` reported `P173_EMULATOR_PROCESS=EXITED`, `P173_EMULATOR_EXIT_CODE_CLASS=NONZERO`, `P173_EMULATOR_EXIT_CATEGORY=UNCLASSIFIED_REVIEW_PRIVATE_LOG`, and hub HTTP 0. This remains an **unexplained early exit**, not a Firestore security regression.

Comparison with P171's previously working launcher found a meaningful difference: P171 preserves the real user's `HOME` for the Firebase CLI process, whereas P173 replaced subprocess `HOME` with the separate `.packtook-demo-emulator-home` artifacts folder. Firebase Emulator binary caches and local CLI configuration may depend on `HOME`. P173 now uses `HOME=str(Path.home())` **only for the local Firebase CLI subprocess**, consistent with P171, while keeping the log in the separate private audit folder. This is a controlled diagnostic candidate, **not yet a proven root cause**, and it does not make Firebase requests to a production project or authorize deployment.

Offline fixture count increases to 8/8. If local startup still fails, keep all gates NO_GO. Review local private logs only with care; do not paste credentials, tokens or unredacted logs.

## P173 fourth operator outcome — verify configuration root before retesting

At P173 offline 8/8, a further Cloud Shell run reported the same nonzero Firebase CLI exit before the hub opened, with `UNCLASSIFIED_REVIEW_PRIVATE_LOG`. Aligning CLI HOME with P171 did not fix the startup problem.

Firebase's documented `firebase.json` Security Rules example points to `firestore.rules` in the **project configuration directory**, not an ambiguous `../firestore.rules` reference from an audit config. P173 now creates a **temporary, mode-0600 Firebase config at repository root**, with `firestore.rules` as the path and the exact local-only Auth/Firestore ports from the pinned audit config. It runs Firebase CLI with that temporary config, preserving the hash-pinned actual root `firestore.rules` (no copied, alternate, or open rules). On process exit it removes the temporary configuration. The committed audit configuration remains as the review specification; it is never deployed. A static fixture asserts the temporary root-adjacent config flow.

This change is a diagnostic candidate. The exact cause of the early exit is not proven without a successful rerun or targeted private local CLI inspection. Offline fixture count is now **9/9**. Production release gates remain NO_GO. Raw logs, credentials, tokens and real project identifiers must not be shared.

## P173 fifth Cloud Shell result — Firestore registered, Auth readiness unresolved

Cloud Shell at `d08f8c8` reported `P173_EMULATOR_PROCESS=RUNNING_BUT_NOT_READY`, hub HTTP 200, Firestore port match TRUE, Auth port match FALSE. This confirms the earlier CLI process-exit and config-root problems have been bypassed, but **does not** establish whether Auth is missing from Hub registration or registered on a different port/type.

The diagnostic candidate now prints only fixed registration Boolean and validated numeric port (or `MISSING_OR_INVALID`) for Auth and Firestore. Do not lower the expected Auth port from 19373 or accept a mismatch as a security PASS; do not create test accounts until both registered services match the configured ports. Rerun local operator tests and use the new `P173_HUB_AUTH_REGISTERED` and `P173_HUB_AUTH_PORT` evidence to choose the next corrective action. No raw Hub response, tokens, secrets, real users or production data exposed.

Static fixtures: 10/10 expected. Local 24-request rules runtime remains unverified. All P172 and production release gates stay NO_GO.

## P173 sixth operator outcome — Auth emulator not registered

Cloud Shell reported `P173_HUB_HTTP_STATUS=200`, `P173_HUB_FIRESTORE_REGISTERED=TRUE`, Firestore 18373 correct, but `P173_HUB_AUTH_REGISTERED=FALSE` and Auth port missing. The Firebase CLI was still running; no 24-case security tests executed. This is **not** a Firestore rules rejection and cannot be counted as tenant-security test success.

The next review-only diagnostic instruments the launcher to **require** Auth localhost port 19373 in the disposable config and to classify a private logfile for an Auth startup error, Auth startup attempt, unrelated Auth mention, or no Auth mention. It also probes **only** whether TCP port 19373 is open on 127.0.0.1. Printed values are restricted to safe fixed labels/Boolean and the predeclared test port; no raw log, tokens, passwords, provider responses or identities.

Expected static fixture result `P173_OFFLINE_FIXTURES=11/11_PASS`. A real test remains blocked until both Auth and Firestore register in the same Hub with expected ports. Preserve `NO_GO_RELEASE / NO_GO_OWNER_IMPORT / NO_GO_DEPLOY`.

## P173 seventh operator result — differential Auth-only test

Cloud Shell at commit `5c862e3` shows Firestore registered at 18373 but Auth not registered, with TCP 19373 CLOSED and a log categorizer reporting `AUTH_NOT_MENTIONED`. This proves neither port mismatch nor Auth startup failure as a root cause: it only establishes that Auth did not become accessible in the dual-emulator process.

To isolate whether Auth itself can start on the same local environment, `audit/p173-auth-only-differential.py` runs **Auth only**, using a separate disposable demo project, temp file config and isolated loopback ports Auth 19375 / Hub 14375 / logging 14376. It does not create users or write accounts or Firestore data. It does not import functions, call cloud endpoints, or deploy. On exit it stops the process group and removes the temp config. Outputs are strictly safe status classifications and predeclared loopback ports.

Run on Cloud Shell *after* updating the review worktree:
```bash
cd "$HOME/packtook-p173"
git fetch origin review/p173-root-firestore-rules-syntax-regression
git checkout --detach origin/review/p173-root-firestore-rules-syntax-regression
node audit/p173-root-rules-fixtures.js
python3 audit/p173-auth-only-differential.py
python3 audit/p173-emulator-root-rules.py
```

Interpretation: Auth-only PASS but dual Auth absent suggests a combined-config/CLI sequencing problem; both failed suggests local Auth bootstrap prerequisites. Neither result certifies production auth verification; 24-rule cases stay unverified until a completed local dual-emulator run. Do not change the dual-emulator expected ports or relax test assertions to force PASS.

All release gates remain NO_GO.
