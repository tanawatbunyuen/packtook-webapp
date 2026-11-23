# P158 — Verify exact official Firestore Emulator artifact in private cache

P157 HEAD confirmed HTTP 200 and Content-Length 136,707,194 bytes for the exact official v1.22.0 Firestore emulator JAR at storage.googleapis.com. HEAD does not prove full GET works. P155 official setup timed out after 180 seconds, and P156 ruled out proxy settings present in the Cloud Shell environment.

This P158 downloads **only** that exact artifact with Python stdlib HTTPS into a private temporary file using 15-second per-read socket timeout and bounded transfer time. The program rejects unexpected response/Content-Length, mismatched file size, invalid ZIP or CRC, and requires at least one .class entry. Only upon verification does it atomically move the JAR to the existing private emulator cache. It preserves v1.21.0, will not overwrite existing invalid target, and cleans incomplete temporary files. It prints only outcome flags and SHA-256. No Firebase CLI, emulator start or staging/production changes.

Cloud Shell:
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p158-verified-firestore-artifact-download
if [ ! -d "$HOME/packtook-p158" ]; then
  git worktree add --detach "$HOME/packtook-p158" origin/review/p158-verified-firestore-artifact-download
fi
cd "$HOME/packtook-p158"
timeout 260s python3 audit/p158-verified-artifact-download.py --download-verified-only
```

A validated v1.22.0 JAR is still **not** proof that Firebase Emulator will launch correctly or that Owner recovered code is safe. The next step, after success, is one bounded local demo-only Firestore/Auth startup followed by explicit emulator identity attestation. Do not import recovered Owner source or deploy anything to staging/production.
