# PACKTOOK V7 — Controlled Staging Device Test (PREPARATION, NOT DEVICE PASS)

## Evidence
- V3: Omise real TEST Charge Cloud Run read-only verification PASS.
- V4: existing paid Business test receipt linked to exactly one credit grant and current wallet read-only audit PASS.
- V5: 13/13 real Firebase Functions credit lifecycle/recovery handler tests in Firestore Emulator.
- V6: 24/24 Staging UI/Recovery mock and source contract tests PASS.

None of these tests implies live video recording was successfully run on a Windows/Chrome device or that current Staging Hosting deploy matches source.

## GATE A — Read-only Staging deployment parity
From an isolated reviewed GitHub worktree, with `gcloud config set project packtook-staging` and `export RR_STAGING_PROJECT_ID=packtook-staging`:
```bash
python3 production/scripts/rr-v7-staging-hosting-parity-readonly.py
```
Default host: https://packtook-staging.web.app. This script only GETs 5 static assets with redirect refusal and compares bytes with the reviewed repository `firebase-staging/` assets. It reports MATCH/DRIFT by asset. Any drift is a **BLOCK**, not permission to overwrite Hosting. Do not deploy anything to fix a drift without separate review.

## GATE B — Read-only actual device capability check
On Chrome 64-bit desktop, navigate only to https://packtook-staging.web.app (if this is the actual Staging site confirmed by Gate A). Open DevTools > Console, paste the complete contents of `production/scripts/rr-v7-browser-capability-console.js`, and run. It checks secure context, camera API existence, WebM codec support, folder picker API existence, and the already-loaded page's video writer, IndexedDB and Firebase bridges. It **does not request camera permission**, choose files, log in, inspect credits, or send network requests.

Expected: `V7_DEVICE_CAPABILITY_PREFLIGHT: PASS`. If any BLOCKED, stop and report the label only (no customer IDs, credentials or video footage).

## GATE C — Owner-controlled physical device scenarios (not authorized by this PR)
Do not begin credit-mutating sessions until a new, segregated test user is provisioned, owner has approved exactly which demo operations may be written in **packtook-staging**, monitoring/rollback is in place, and existing customer paid charge and billing records are excluded. An already paid Business Charge does NOT authorize consuming its wallet credits.

Manual test order, after controlled Staging write authorization:
1. Windows Chrome current stable, trusted test camera; confirm camera ON/OFF, 720p, desktop folder access and disk writable (no customer recordings).
2. Login using an isolated Staging-only verified test account; confirm no pending reservations and record starting balance. No real charges created; test account billing provisioning must be separately approved.
3. Scan synthetic barcode `V7-TEST-0001`; verify one reservation and one wallet credit held. Begin recording. Rescan identical barcode to stop.
4. Open resulting WebM locally, verify visible moving video, duration, no black frames, size >1000 bytes, and valid audio policy (if applicable). Confirm one completed recording, exactly one debit, audit and history.
5. New synthetic barcode `V7-TEST-0002`; simulate a controlled interruption only on the isolated account. Before any refund, inspect original folder, partial video, server recording state and pending operation intent. If any usable video is present, DO NOT refund. Explicit manual review required.
6. Negative cases: offline network during finalize, browser restart during REC, insufficient disk space, camera loss, repeated stop, duplicate barcode, delayed server response and restart recovery. Run disruptive tests last, never on actual customer uploads.
7. Credits: verify `wallet_after = wallet_before - completed_count - active_reservations` for an isolated test with no concurrent purchases/refunds; failed explicitly confirmed no-video recordings must refund once. Audits must match.
8. Evidence: pass/fail matrix, browser version/OS/device type, timestamps, anonymized operation IDs, count of recordings and credit balances, file WebM size and playback outcome. **Do not upload videos containing customer details or credentials**.

## STOP conditions
- Staging Hosting drift or wrong Firebase project.
- Public signup unexpectedly enabled.
- Paid account used instead of isolated test account.
- Camera black frames, corrupted/unplayable video or disk write failure.
- Any refund while usable video exists, unexplained wallet mismatch, active unverified recording or duplicate audit.
- Unknown server status, inability to validate original recording folder or poor permissions.

## Current release decision
Gate A and Gate B require operator execution; Gate C remains unauthorized and not performed. All changes are on Draft GitHub review PR only; no Deploy, no Staging/Production writes, no video captured, and Public Signup remains closed. **NO_GO_RELEASE.**
