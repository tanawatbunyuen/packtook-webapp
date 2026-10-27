# PACKTOOK V3.4.1 Barcode Hotfix

## Root cause
The Enter-key listener set `reservation=true` and then called `startRecording()`, which immediately returned because it rejected calls while `reservation` was true. REC could never start through the Barcode input.

## Fix
- Remove the contradictory `reservation` guard in `startRecording()`; retain it in the Enter handler for duplicate-scan protection.
- Add visible messages for empty scans, busy state, and uncaught failures.
- Refocus scanner input after login and after scan processing.
- Cache-bust the main JavaScript with v3.4.1.

## Test
1. Open Chrome/Edge on HTTPS GitHub Pages; log in, open camera and choose folder.
2. Focus Barcode field, type TEST001 and Enter; confirm RECORDING indicator and timer.
3. Scan TEST001 again to stop; confirm saved WebM, quota +1, dashboard playback.
4. Ensure new barcode during recording is rejected with informative message.

This static demo does not implement secure SaaS authentication or server-side subscription enforcement.
