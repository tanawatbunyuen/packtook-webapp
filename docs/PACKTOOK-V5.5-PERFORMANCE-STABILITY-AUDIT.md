# PACKTOOK V5.5 — Performance & Stability Audit

Audit date: 2026-10-31. Branch: `feature/firebase-auth-credits-v4`. Status: **read-only code review; no application changes**.

## Evidence so far
User-confirmed staging functional acceptance **6/6**:
1. Scan-to-REC faster.
2. Scan-to-STOP shows STOPPED / SAVING immediately.
3. Video saved and decoded, non-black.
4. Exactly one credit deducted per successfully saved video.
5. Concurrent scan blocked while SAVING.
6. Five to ten consecutive packing orders without hang.

This is functional regression success, **not proof of latency percentiles** or 8-hour endurance. The user has not reported actual console timings.

## Actual event sequence and remaining costs

**Start (browser):** barcode Enter -> folder permission query -> `reserveCredit` callable -> Firestore transaction (account, recording, barcode lock and optional approval) -> `MediaRecorder.start(1000)` -> REC UI. Prior redundant `usageStatus` and `deviceStatus` roundtrips have been removed. This leaves network latency and Cloud Functions initialization as possible bottlenecks. Do **not** start billable recording before server authorization.

**Stop:** repeat barcode -> `MediaRecorder.stop()` requested immediately -> STOPPED/SAVING UI -> asynchronous final `dataavailable`/stop event -> Blob constructed from chunks held in `parts[]` -> write entire Blob to local directory -> verify size + decode video and sample pixels/frames -> `finalizeCredit(true)` Firestore transaction -> `usageStatus` refresh -> browser local history in localStorage -> READY. Stop feedback is quick; READY necessarily takes longer.

**Instrumentation already in V5.5 browser console:**
- `[PACKTOOK] Barcode → REC start: N ms`
- `[PACKTOOK] Barcode → recorder.stop() requested: N ms`
- `[PACKTOOK] Barcode → MediaRecorder stop event: N ms`
- `[PACKTOOK] Barcode stop → file saved, verified and credited: N ms`

## Code-level risk register

| Priority | Risk | Evidence | Recommended next iteration |
|---|---|---|---|
| P1 | RAM growth for long REC | MediaRecorder `ondataavailable` pushes all chunks into `parts[]`; whole Blob is then written at Stop | Evaluate chunk-to-file incremental writes with a temp/incomplete-file protocol and a strong finalize/recovery transaction; benchmark first |
| P1 | Uncertain network response during credit reservation | Browser writes `pending` to localStorage only **after** it receives `reserveCredit` confirmation; server could commit during a client timeout | Persist safe operation-intent before network call and reconcile status by operation ID; must not auto-refund a potentially successful video |
| P1 | Uncertain saved-video / backend finalization | Save and verify are local, while `finalizeCredit` needs a remote response; reboot/network interruption can leave a reservation pending | Recovery UX should distinguish 'file saved, awaiting server' from 'no file'; do not automatically release credits if evidence exists |
| P2 | Stop-to-READY blocked by full verification and remote quota refresh | Awaited `verifySavedVideo`, `finalizeCredit`, `refreshRemoteQuota` before READY; verification includes metadata, pixel samples and seek | Add per-phase performance timings first. Consider asynchronous quota refresh **only after** confirmed finalize, with stale-response protection |
| P2 | Multi-device contention | Each reserve/finalize transaction reads/writes the same account wallet document | Test 3/5/10 devices with simultaneous scans; monitor transaction retries/ABORTED |
| P2 | Browser localStorage history grows | `store.logs` is synchronously serialized on each successful save; Dashboard builds all matching table rows | Consider IndexedDB for metadata and paginated/virtualized history when testing 1,000+ videos |
| P2 | Health monitoring granularity | Health timer samples track every 3.5 seconds; track-live can miss a frozen/static preview | Report recording-health warnings; test camera unplug/replug, browser focus changes, USB hub power loss and long sessions |
| P3 | No durable local performance profile yet | Console logs are temporary; duration/size statistics not collected across runs | Optional local-only Performance Monitor: p50/p95 REC start, stop event, saving, failures, file size; avoid uploading raw barcodes/customer data |

At current configured rates, approximate encoded **720p** video is ~1.8 Mbps (~13.5 MB/min) and **1080p** is ~3.5 Mbps (~26 MB/min), subject to actual codec/frame content. Holding every chunk in memory can become expensive during extended packing sessions.

## Suggested performance targets (provisional engineering goals, NOT measured outcomes)
- Warm network, scan → REC start **p95 <= 1.5 s** where practical; slow/cold starts can exceed this.
- Scan → STOPPED visual feedback **p95 <= 200 ms**.
- No video black screens, no lost usable video evidence; all paid credits must reconcile.
- Complete 50 short scans consecutively without hang; then 200 orders during a shift.
- 30-minute continuous REC followed by verified playback.
- 8-hour soak test with camera connected, mixed idle and recording; observe memory and tab restarts.
- Test temporary offline during (a) reserve (b) recording (c) save (d) finalize. Never silently assume payment/credit status after a network timeout.

## Recommended test reporting template

Use one test PC, Chrome or Edge version, camera, resolution, storage type (SSD/HDD/network folder), Internet connection type, order/video length.
Capture **30 separate barcode starts**, calculate min/median/p95/max of Barcode→REC.
Capture **30 stop events** and **30 save-and-credit completion times**. Report video size/duration.
Record Firebase errors, `reserved` reconciliation, and 10-minute checks of memory in Chrome Task Manager (`Shift+Esc`).

## Release guidance
V5.5 passed all user-reported functionality tests. No source changes were made by this audit. The next safest development is a **V5.6 local performance monitor** and a prolonged memory/network test, before attempting more aggressive recording or credit lifecycle changes. Do not change Omise, billing wallet or credit accounting as a latency shortcut.
