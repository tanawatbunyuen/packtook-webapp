# PACKTOOK GitHub Pages Demo

Static demo: HTML/CSS/JS. No Node.js, database, or server required. This repository is **not** the commercial SaaS backend.

## Deploy on GitHub Pages

1. Create a new public GitHub repository named `packtook-webapp` (separate from the legacy `packing-video-recorder`).
2. Upload `index.html`, `style.css`, `app.js`, `logo.svg`, `.nojekyll` to the repository root.
3. Repository > **Settings > Pages > Build and deployment > Deploy from a branch**. Select **main** and **/(root)**, Save.
4. Visit `https://<github-user>.github.io/packtook-webapp/` after deployment is complete. URL is an example until published.

## Demo login
- Email: `demo@packtook.test`
- Password: `DemoPacktook2026!`
- Client-side only. These are public sample credentials **NOT** authentication; anyone can inspect the code.

## Features
- Responsive PACKTOOK premium login, navigation, pricing preview, quota display.
- Camera preview, Barcode scan via keyboard+Enter; same barcode stops and saves WebM to a user-authorized local directory.
- Basic history stored in this browser's localStorage.
- Quota = one successfully written video, including repeated barcode; monthly counted by local device date. Local quotas and plan changes are **not secure** and cannot be enforced across devices.
- Password demo and pricing simulation are for UX testing only. No payments are charged.

## Requirements and limitations
- Latest desktop Chrome or Edge; HTTPS (GitHub Pages provides it), camera access and directory access granted by user.
- Works only while page is open; avoid screen sleeping and browser tab suspension. No crash-proof guarantees.
- Local file writing is not supported in all browsers. iOS Safari cannot use the required desktop directory picker.
- Dashboard lists filenames but doesn't automatically reopen saved videos because browser folder permissions aren't persisted by this demo. Open actual recordings from the local folder.
- Video is **not** uploaded to GitHub or Cloud.
- Monthly limits are locally simulated only. For commercial subscriptions implement server-authenticated account, signed entitlements, atomic quota reservation/commit, secure storage and payments.
- Do not store real secrets in repo. This repo is intentionally static and public.
- No promises of long-duration camera reliability: carry out endurance, disconnection, disk-full and power-loss testing prior to production.
