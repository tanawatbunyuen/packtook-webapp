# PACKTOOK V6 — Staging Recorder Integration & Recovery Preflight

## Baseline
V3 real Omise Test Mode charge verified (Cloud Run read-only), V4 historical paid Business receipt and one matching credit grant audited in Staging, and V5 real credit reserve/finalize/stale-recovery handlers passed on a demo Firestore Emulator (**13/13**). None of those prove a real camera/video recorder in Staging.

## Implementation in this draft PR
V6 reads and exercises **the current repository's actual `firebase-staging/app.js` `recoverCredit` function** in a Node VM with all UI/Firestore/file-system/confirmation calls mocked. Unit scenarios cover saved video, unreadable file, missing folder, declined confirmation, wrong folder, unknown operation, offline API, completed-without-file and failed-with-file. Browser code is loaded as-is for the tested function; the harness never invokes real Firebase, camera, Omise, File System Access or cloud APIs.

Separate source contract tests cover **real Staging page** order of operations:
- Local operation intent stored BEFORE remote reservation call.
- Video writer opened only AFTER server has returned reserved.
- MediaRecorder starts after writer initialization.
- A network timeout leaves durable intent for reconciliation.
- Disk writer finish + saved video verification precede `finalize(success=true)`.
- A completed Firebase finalization precedes local history saving and clearing pending state.
- Stop-time failure preserves partial video and pending evidence; never automatically refund an uncertain stopped recording.
- Same Barcode to stop and different Barcode rejected during REC; device and Firebase callable bridge wiring.

## Identified risk / release gating
Static contract and mock browser functions can detect state and ordering regressions but **cannot verify actual file integrity, camera freeze, MediaRecorder stop events, browser permission prompts, File System Access API persistence, cross-tab concurrency, or offline recovery across app updates**. Manual physical-device testing is REQUIRED before public rollout. The client recovery flow can call `finalize(false)` when the operator explicitly confirms there is no usable saved file; this path must be tested manually with an isolated demo account, never a paid customer record. Backend provides a separate aged reservation recovery operation that demands at least 30 minutes; do not confuse that with the user-confirmed immediate `finalize(false)` for a reserved recording.

## Operator verification checklist (manual, NO Staging writes until separately authorized)
Read-only review of Staging Hosting asset deployment and versions, browser support, owner login, camera/folder permission states and a *non-mutating* analysis of any pending test operations. Do not create reservations, recover existing customer recordings or grant/refund wallet credits in live Staging as part of this preflight. For real integrated device validation, arrange separately approved isolated test account with monitoring, backup, and rollback and verify video content directly by playing saved files.

**No Production change; Public Signup Closed; NO_GO_RELEASE.**
