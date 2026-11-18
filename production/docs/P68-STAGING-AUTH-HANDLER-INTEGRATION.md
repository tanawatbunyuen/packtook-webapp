# P68 — Staging Authorization + Original Handler Integration Candidate

Status: DRAFT; DEMO EMULATOR ONLY, NOT A DEPLOYABLE STAGING PATCH.

## What has been implemented
- An isolated bridge wrapping the **five unchanged callback bodies** from
  `production/functions/index.js` with the P65 per-request authorization,
  live Firebase Auth user lookup, Firestore Pilot Lease and App ID checks.
- Validated requests may execute the real Credit/Recording handler against
  the `demo-packtook-p67` local Firestore Emulator only.
- Unauthorized or revoked requests are denied BEFORE any mutation.
- Credit reserve/finalize/recovery and status are tested with the actual
  callbacks; no simulated transaction logic is substituted.
- A standalone App Check static preflight reports whether shared callable
  options contain an explicit `enforceAppCheck:true` literal. It never
  converts that observation into runtime enforcement proof.

## Key limitations
- P67 uses a test-only Production Beta environment shim inside the VM
  because the original handlers use a Production-bound `uid(req)` check.
  P68 creates a test-only Beta token projection ONLY AFTER a successful P65
  Staging Gate decision; no real Production token, IAM or environment is used.
  This is **not** a deployment implementation.
- Firebase callable transport is mocked. Runtime ID-token verification,
  cryptographic App Check enforcement, actual deployed Staging source,
  live Auth/Firestore permissions and complete Cloud Functions lifecycle
  are still NOT VERIFIED.
- P65's authorization candidate and P68 bridge are not registered or
  deployed as callable exports. Current Staging source still shows P63
  `recordingStatus`/`usageStatus` guard drift.
- Current review `production/functions/index.js` shared options do not
  explicitly set `enforceAppCheck:true`, and this preflight is not proof
  of Cloud backend enforcement (even if a literal is added).
- Tests do not imply that the existing Production Beta policy can be used
  in Staging. A Staging-specific complete runtime with reviewed environment
  guards, callable options, role boundaries and rollback is still required.

## Mandatory gates before a Staging deploy
1. Review design and implementation of genuine Staging-only callable source;
   remove VM shims and remove any Production-bound checks from Staging runtime.
2. Audit all transitive dependencies, use least-privilege identity and
   binding; do not merely copy Production functions or change flags.
3. Obtain an approved App Check backend enforcement plan and verify that
   missing/invalid App Check credentials are denied by the actual callable.
4. Run Firebase Functions transport/emulator and security negative tests,
   credit concurrency, idempotency and recovery across a broader matrix.
5. Explicit owner approval for a narrowly scoped Staging deploy, including
   pre-deploy immutable source/generation backup, rollback and monitoring.
6. After any authorized deploy, repeat P62/P63 source attestation,
   immutable generation stability, and independent authorization review.

GitHub Actions executes only in a demo Firebase Emulator. No Cloud writes,
no Staging changes, no Production changes, no merge or deploy approval.

**RELEASE=NO_GO_RELEASE**
