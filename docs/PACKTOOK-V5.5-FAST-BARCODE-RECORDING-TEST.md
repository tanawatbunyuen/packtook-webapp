# PACKTOOK V5.5 — Faster Barcode REC / STOP responsiveness (Hosting only)

## Goal
Reduce the user's 2–3 s delay after scanning a barcode to start/stop packing video, while preserving authoritative server-side credit/device/duplicate checks and local WebM verification.

## What changed
1. **Start/REC:** previously the browser synchronously waited for `usageStatus`, `deviceStatus` (inside `setupDevice`) and `reserveCredit`, all as separate network roundtrips. The normal path now calls **only `reserveCredit`**, which *already* enforces device registration, subscription expiry, quota and duplicate barcode protection in a Firestore transaction. The frontend displays **กำลังขอสิทธิ์เริ่ม REC…** while that one required server call is pending.
2. **First scan on an unregistered device:** if the server explicitly returns a device-registration error, the client invokes `setupDevice` and retries **the same reservation operation ID**. This only happens on the uncommon unregistered-device path; ordinary scans avoid the extra calls.
3. **Stop:** when the same barcode is scanned or Stop is clicked, `MediaRecorder.stop()` is called synchronously before file I/O / remote finalization. `stop()` itself emits a final `dataavailable` event; the redundant `requestData()` call has been removed. The UI now immediately displays **STOPPED • SAVING** rather than suggesting the camera is still recording.
4. While saving, the camera health poll does **not** falsely report recording failure. Barcode scanning remains blocked until the saved file is written, decoded/checked for non-black frames and `finalizeCredit(success=true)` completes.
5. Chrome/Edge DevTools Console logs three performance points (no raw barcode):
   - `[PACKTOOK] Barcode → REC start: X ms`
   - `[PACKTOOK] Barcode → recorder.stop() requested: X ms`
   - `[PACKTOOK] Barcode → MediaRecorder stop event: X ms`
   - `[PACKTOOK] Barcode stop → file saved, verified and credited: X ms`

**Important:** a brand-new recording is not started until the authoritative Firebase reservation completes, so network latency / Cloud Function cold start can still add time. This avoids granting unsanctioned recording or spending more credits than allowed. Also, showing STOPPED quickly does not mean the file is already saved: wait for the "บันทึกสำเร็จ" confirmation before starting another job or closing the browser.

## Deploy — Hosting only

```bash
cd ~/packtook-webapp
git checkout feature/firebase-auth-credits-v4
git pull origin feature/firebase-auth-credits-v4
firebase deploy --only hosting --project packtook-staging
```

Open `https://packtook-staging.web.app/` and Ctrl+Shift+R.

## Acceptance tests
1. Start camera and select writable folder; scan a **new** barcode, watch "กำลังขอสิทธิ์เริ่ม REC…" then REC active. Compare delay to old V5.4.
2. Open DevTools Console (F12) and record **Barcode → REC start** timings for five consecutive distinct barcodes; record time for each, not just an average.
3. While recording, scan the **same** barcode: badge changes from **RECORDING** to **STOPPED • SAVING** immediately.
4. Confirm actual `MediaRecorder stop event` is fast; the "file saved, verified and credited" event may take longer.
5. Wait until the file is saved and credit finalized. Ensure Dashboard can open the video, file is non-black, and exactly **one** video credit is deducted.
6. Scan a second barcode *during SAVING*: system must block the new order until finalization; it must not start concurrent recordings.
7. Scan a duplicate completed barcode: approval process still works, and an unauthorized duplicate is blocked.
8. With quota 0, disconnected/unregistered device, or expired plan, server still blocks new recording. First scan on a new device may require registration once.
9. Camera interruption / disk-write error: error state remains visible and a pending credit is only refunded after reliable backend failure finalization.
10. Retry across multiple minutes to detect recorder getting stuck, black video or memory pressure. Do not close browser while STOPPED • SAVING is displayed.

## Scope
Frontend `firebase-staging/app.js`, `style.css`, and `index.html` only. No Cloud Functions or Firestore changes; PromptPay, subscription and wallet rules are unchanged.

Static source checks passed 17/17. Real browser response time and successful video recording must still be tested on Staging.
