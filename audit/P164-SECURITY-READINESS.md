# P164 — Client write denial and unlisted-path review (demo-only)

## Evidence and boundary

- P163 **real operator Cloud Shell** result: reviewed root `firestore.rules` blob verified, **single-semicolon normalized isolated candidate** verified, isolated emulator registered, own/cross-account/anonymous read matrix 18/18 PASS, local Auth account cleanup PASS.
- Root `firebase.json` references `firestore.rules`, not the normalized copy. Root source currently has a missing `;` on `signedIn()` helper return; candidate normalizes only this syntax error. **No source rule edit, merge, deploy, or production rules attestation is authorized.**
- P164 reuses P163's isolated local process lifecycle, exact source hash validation, separate ports, private HOME and candidate; never contacts staging/production and never imports recovered Owner functions.
- P164 **attempts** 18 local Firestore client commits via Firestore REST API (two accounts × own/cross/anonymous × account/recordings/audit), and insists each is denied HTTP 403. It records the number of successful client writes and fails closed if any succeed. No admin bypass, no seeded documents.
- P164 also tests 9 GETs on paths not covered by source rules: signed-in A and B, and unauthenticated. Each must return HTTP 403. The tests create two disposable Auth Emulator accounts and delete them in finally.
- **A successful P164 result attests negative access of this one candidate, not deployed source rules, permitted client operations, protected data lifecycle, or Backend/Owner Function authorization.** Backend Admin SDK bypasses client Firestore Rules and requires separate reviews.
- GitHub CI is fully mocked; cannot be described as real emulator attestation.

## Execute only in local demo Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p164-client-write-denial-rules-hardening
if [ ! -d "$HOME/packtook-p164" ]; then
  git worktree add --detach "$HOME/packtook-p164" origin/review/p164-client-write-denial-rules-hardening
fi
cd "$HOME/packtook-p164"
python3 audit/p164-client-write-denial.py
```

Look for:
`P163_SOURCE_RULES_GIT_BLOB_MATCH=PASS`, `P163_ISOLATED_RULES_SINGLE_SEMICOLON_DELTA=PASS`, `P163_ISOLATED_REGISTRY=PASS`,
`P164_ACCOUNT_1_SIGNUP=PASS`, `P164_ACCOUNT_2_SIGNUP=PASS`,
all `P164_..._WRITE_PATH_*=PASS` and `P164_..._UNMAPPED_READ_*=PASS`,
`P164_DISPOSABLE_AUTH_CLEANUP=PASS`,
`P164_SUCCESSFUL_CLIENT_WRITES=0`,
`P164_DECISION=LOCAL_SOURCE_RULES_WRITE_DENIAL_ATTESTED`, and `P163_EMULATOR_PROCESS_STOPPED=TRUE`.

## Deployment readiness remains blocked

1. Review and separately approve precise `firestore.rules` syntax correction (not done here).
2. Verify production/staging deployed rules provenance and differences using approved **read-only** access; no cloud calls in P164.
3. Audit Firebase Admin SDK callers, Owner recovered source provenance, role authorization, App Check, tenant isolation, and error handling.
4. Test approved production-equivalent policy on isolated emulators before any deployment; stage gate remains NO_GO.
5. Independently review and sign off legal, billing, monitoring, backup/rollback and owner authorization gates.

**NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**
