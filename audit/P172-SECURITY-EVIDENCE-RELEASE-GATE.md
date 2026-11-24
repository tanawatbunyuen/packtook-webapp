# PACKTOOK P172 — Security Evidence & Release Gate Decision

**Decision: NO_GO_RELEASE, NO_GO_OWNER_IMPORT, NO_GO_DEPLOY.**

Date: 2026-11-24. Review-only. This report reconciles user-reported Cloud Shell results and existing review documentation with immutable Git source blobs. The user-reported terminal logs are not independently reproduced by this static checker. This report is **not** a pentest, production certificate, or deployment authorization.

## Verified source fingerprints

- `functions/index.js`: Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3`
- `firestore.rules`: Git blob `d3e43720eb079c7f0fec50ec7f4e622fd7316e4a`
- `firebase.json`: Git blob `d0ae066640c435d3d304915ecaac4084584722c4`; references root `firestore.rules`, not the normalized P163 candidate.

## Evidence classification

| Phase | Evidence / outcome | Strength and limits |
|---|---|---|
| P165 | Backend source static review completed with six review findings | No deployed function verification; Admin SDK bypasses client Firestore rules |
| P166 | 4/4 integrity fixtures; 8/8 extracted guard mocks pass | Not full runtime |
| P167 | 4/4 fixtures; 12/12 denied before fake datastore; 2/2 synthetic Owner empty-result tests pass | Complete source-extracted handler bodies, but instrumented fake datastore and no real Firebase callable |
| P168 | Local callable Functions/Auth emulators used, 16/18 strict expected responses pass | Invalid supplied token enters handler and yields **403 PERMISSION_DENIED**, not 401 UNAUTHENTICATED; zero *fake* reads. P168 remains **NO_GO_CALLABLE_HTTP_INCOMPLETE** |
| P169 | Read-only versions: Firebase CLI 15.34.2, Node v26.13.0, Functions SDK 6.6.0, Admin SDK 13.10.0 | No production auth signature verification |
| P170 | 18/18 synthetic JWT test cases using ephemeral RSA and a custom independent verifier | **Not Firebase Admin SDK production `verifyIdToken`** |
| P171 | 6/6 fixtures. Auth emulator token accepted; malformed and changed-audience token rejected. Local token shape UNSIGNED; signature mutation not applicable | Actual Firebase Admin SDK called with local Auth Emulator, but no signature cryptography attested |

*The corresponding user-reported Cloud Shell outputs were supplied during the review sequence. CI only exercises the test suites indicated by each phase; it cannot automatically certify the operator's terminal log or any deployed version.*

## Open blocking conditions — all NO_GO

1. **G01 Root Firestore Rules:** referenced root rules have a missing semicolon; actual deployed rules not verified. P163/P164 used isolated corrected candidate only. Require source patch review, emulator regression, and separately authorized production rules verification.
2. **G02 Backend authorization findings:** customer role self-admin interpretation, approval model, broad account queries, public payment webhook review, and backend Admin SDK access require explicit code-owner review. P165's static findings remain open.
3. **G03 Callable protocol:** malformed Authorization token in P168 local emulator yielded HTTP 403 and reached handler; protocol calls for HTTP 401. Upstream emulator debug mode may bypass token signature checks; *do not loosen the expected production protocol*.
4. **G04 Production JWT verification:** Local Auth Emulator supplied unsigned JWT; P170 signed candidate is **not** the Firebase SDK production verifier. Production-equivalent signature checks, key rotation and revocation have not been authorized or attested.
5. **G05 Recovered Owner code:** four recovered Owner Functions have not passed provenance and independent source review; **do not import or execute them**.
6. **G06 Runtime security:** production App Check, IAM, secret access, function revision provenance and tenant isolation under actual Admin SDK have not been proven by these local tests.
7. **G07 Operational/legal:** billing budgets, alerts, incident monitoring, privacy/PDPA and owner-facing legal approvals still require written evidence.
8. **G08 Owner sign-off:** explicit Owner authority for any release/merge/deploy/public signup/Owner import is absent.

## Release decision discipline

P172's `audit/p172-release-gates.js` **only** fails closed on pinned source drift, missing referenced documents and any attempt to relabel an open blocker or user-reported emulator result as a production approval. Passing CI means the **NO_GO evidence manifest is internally consistent**, not that PACKTOOK is ready to launch. Do not convert a green CI badge into release approval.

## To run in Cloud Shell

```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p172-auth-security-evidence-release-gates
if [ ! -d "$HOME/packtook-p172" ]; then
  git worktree add --detach "$HOME/packtook-p172" origin/review/p172-auth-security-evidence-release-gates
fi
cd "$HOME/packtook-p172"
node audit/p172-release-fixtures.js
node audit/p172-release-gates.js
```

Expected: `P172_OFFLINE_FIXTURES=6/6_PASS`, `P172_SOURCE_PINS=3/3_PASS`, `P172_EVIDENCE_DOC_REFERENCES=6/6_PASS`, `P172_RELEASE_DECISION=NO_GO_RELEASE`.

No credentials, writes, emulator startup, cloud calls, imported recovered functions or deployments.
