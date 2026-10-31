# PACKTOOK V5.6 — RAM, Credit Recovery, and Scalable Video History

Status: GitHub staging branch code committed, NOT deployed or verified against real webcam/Chrome/Edge. Production and default demo branch untouched.

## Fix 1 — RAM / recording stream
- New `firebase-staging/video-stream-writer.js` writes every MediaRecorder WebM chunk to a user-selected File System Access writable stream, in sequence.
- Previous `parts[]` collection + `new Blob(parts)` after stopping were removed. The page keeps a bounded pending write queue, limited to **24 MB**, with explicit failure/review if disk cannot keep up.
- Filename is generated at scan start (Barcode + timestamp + operation ID fragment); file opened after Firebase grants reservation, before MediaRecorder.start.
- The recorder issues stop immediately on the second Barcode scan; waits for final `dataavailable`, then finishes the writer, verifies file size/decode/frames, and calls `finalizeCredit(success=true)`.
- The browser's File System Access `createWritable` API may stage changes until `close()`. **This reduces JavaScript RAM usage but does not guarantee playable partial files after a forced browser crash or power failure.** Never advertise crash-proof video capture without further storage design.
- If a writer error or partial file occurs, the operation remains unresolved for human inspection; the app does not automatically issue `finalize(false)` after recording started.

## Fix 2 — Uncertain Firebase round trips
- The browser persists `{operationId,barcode,phase,filename,folderName,worker,...}` to localStorage **before** sending `reserveCredit`, allowing reconciliation even when Firebase commits but the network response is lost.
- Distinguishes deterministic server rejections (quota exhausted, device blocked, duplicate denied) from ambiguous network/transport failures. A pending operation is not cleared merely because a quick follow-up lookup returns not-found while the original request may still be in flight.
- Start failure before MediaRecorder starts can safely finalize an explicitly granted reservation as failed.
- The stop path persists stages: `stopping`, `file_written`, `verified`, `finalizing`, `completed`. A network error after file write/verification **does not refund automatically**.
- Packing's **ตรวจสอบเครดิตจองค้าง** now checks the original folder, server operation status and local file. If the file is valid but server status is Reserved, user can confirm completion so backend counts one credit. If server already Completed, local metadata can be restored idempotently. If no file and Reserved, explicitly confirm no usable file on any device before returning credit. If no server record exists, wait at least 30 seconds before clearing stale intent with confirmation.
- Existing server-side reserve/finalize idempotent transactions, device lock, duplicate approval, wallet accounting, packages, and payment functions are unchanged.

## Fix 3 — IndexedDB history and paging
- New `firebase-staging/video-history-db.js` (IndexedDB `packtook-video-history-v1`): indexed by time, local day and month; videos themselves never enter IndexedDB.
- Existing localStorage `store.logs` are upserted in a transaction. The legacy list is removed from localStorage **only after** IndexedDB migration succeeds. A failed migration leaves the original metadata untouched.
- Dashboard now queries and renders **50 records at a time**, with **โหลดวิดีโอเพิ่มอีก 50 รายการ** button; index-driven date range, streaming Barcode search, counts, and retention lookups. No 5,000-row HTML rendering in one frame.
- Retention deletes at most 100 eligible local videos per pass (with user permission); missing files retire stale metadata; successful manual file deletion also removes IndexedDB metadata.
- If IndexedDB is temporarily unavailable, newly finalized video metadata is backed up to legacy localStorage; inspect local files and do not clear browser data. Existing localStorage fallback metadata is not a guaranteed substitute for a healthy IndexedDB environment.
- IndexedDB is *per browser profile and origin*, not synchronized across PCs. Local video files remain in the chosen folder.

## Deploy — Hosting only

```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only hosting --project packtook-staging
```

Open https://packtook-staging.web.app/ and hard refresh Ctrl+Shift+R.
No Cloud Functions or Firestore Rules deploy is required.

## Acceptance / rollback gates

### Baseline
1. Record 5 short orders. Confirm each scan starts REC only after Firebase authorized, stops immediately, writes a playable non-black WebM; Dashboard opens each file.
2. Verify credits decrement by **one** per completed video. Test duplicate barcode approval, quota exhausted, unregistered device, and expired membership.
3. Confirm Dashboard can select dates/search barcodes and load next **50** records. Refresh browser and ensure recent records remain in IndexedDB.

### Stress and RAM
4. Record 30 minutes continuously at default 720p. Observe Chrome Task Manager (Shift+Esc) every 5 min; ensure RAM does not climb with total video size as it did when every chunk stayed in `parts[]`.
5. Run 50 short order captures and one 1080p video; monitor stream queue errors, file quality, memory pressure and any stuck SAVING state.
6. Artificially slow destination storage: verify disk-backpressure stops recording safely and leaves a review flag. Do **not** silently consume/refund credits.

### Network / recovery
7. Toggle DevTools Offline while trying a new scan, then restore network. If the server grant is ambiguous, local Operation ID remains; **do not rescan until recovery**.
8. Force Offline *after local file save but before Firebase finalize* in an isolated test account: verify the file stays, the operation is reviewable, and reconnecting then verifying file completes exactly one credit debit.
9. Test a failed recording with no saved usable file; user explicitly confirms this before returning held credit.
10. Refresh/close during REC: browser warns on normal close. Forced crash or power-off may leave an incomplete/absent file (File System Access writes are committed on close); manual recovery must not assume success. This test is **destructive; use a separate staging test account and disposable folder**.

### History and retention
11. Back up localStorage, migrate a legacy browser with 1000+ records. Verify the count, filtering, pagination, and new records after reload. Do not clear browser data until migration is confirmed.
12. Test retention of >100 old videos; perform several passes as needed, inspect removed local files and DB entries, ensure no videos outside the chosen folder were removed.
13. After a saved video is manually deleted, metadata disappears; payment, subscription, credit carryover, and video recording remain unchanged.

## Release criteria
- Zero missing completed videos, accidental double grants/refunds or incorrect credits.
- No unexplained reservations after recovery.
- No black recordings in 50 sequential operations.
- Stream memory use stays bounded on a 30-minute video.
- History 1000+ entries remains usable with 50-row pagination.
- **Do not promote to production** until a real browser/USB camera endurance run and network-failure tests pass.
