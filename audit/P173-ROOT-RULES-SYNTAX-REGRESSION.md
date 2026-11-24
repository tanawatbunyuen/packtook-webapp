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
