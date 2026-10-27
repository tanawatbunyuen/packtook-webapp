# PACKTOOK V3.4 — GitHub Pages Demo

## Installation
Upload all files from this folder to the GitHub repository root, then enable **Settings → Pages → Deploy from branch → main → /(root)**. Use Chrome or Edge Desktop over HTTPS.

## Demo credentials
- Email: demo@packtook.test
- Password: DemoPacktook2026!

## New in V3.4
- Play recorded videos directly from Dashboard by selecting the SAME local folder containing the files.
- Save the File System Access directory handle to IndexedDB; reconnect folder on revisit after browser permission prompt.
- Detect stopped/muted cameras and attempt recovery. If the camera disconnects during recording, try to finalize available recorded chunks.
- Stop timeout and improved error handling; check local file size after write.
- Keep the premium UI and infographic help page from V3.3.

## IMPORTANT limitations
This is a static frontend-only demo with localStorage-based login and quota. **No secure server-side subscription or real multi-device enforcement**. Video recording requires permission and uses `MediaRecorder` + Chromium File System Access API; must be tested with camera/barcode hardware. The auto-recovery is best-effort; it cannot guarantee recovery of video when the browser/OS crashes. Browser data clearing removes local history, not the video files. Do not store production credentials or use as an enforcement/billing system.

## Test plan
1. Login, open camera, select folder, start recording by barcode, scan again to stop. Confirm `.webm` exists and plays.
2. Open Dashboard and click playback. Test after refresh and reconnect the saved directory.
3. Disconnect/reconnect USB camera mid-recording and observe status and resulting video.
4. Test repeated scans, invalid folder permissions, full disk, quota reached, camera used by another app.
5. Test 2–4 hours uninterrupted on actual packing hardware before deploying for business use.
