# Fast Track Gate A3 — Exact review-candidate mock browser smoke

**Purpose**: run the exact already-verified pinned Gate A ZIP in a **real local Chromium browser** while replacing Firebase SDK imports with explicit in-memory mocks. It is a candidate browser compatibility test, not a real App Check or registered-origin test. Works only if Playwright and Chromium have been installed deliberately in the execution environment. No automatic installation or deployment.

## Safe environment
- Wrapper: `audit/fast-track-full-public/gate-a-browser-mocked-smoke.py`.
- Browser driver: `audit/fast-track-full-public/gate-a-browser-mocked-smoke.cjs`.
- Verifies known archive SHA-256 and manifest classification; extracts to a `TemporaryDirectory` and serves on `127.0.0.1` only.
- Playwright intercepts every HTTP request. Four gstatic Firebase ESM URLs are replaced with mocks. Any other external connection is **aborted**; service workers blocked, downloads disabled, no credentials or real App Check token.
- Inspects `window.PACKTOOK_FIREBASE.ready`, status callable dispatch via mocks, App Check mock initialization once, Login DOM presence and fatal JS errors.
- Disposes browser and temporary files, does not modify Git working tree, Firebase hosting, public signup, IAM or customer records.
- The manifest/ZIP have public Firebase client metadata (not admin secrets); outputs never display their contents.

## Operator command after dependency prerequisites
```bash
cd ~/packtook-p23173 || exit 1
git pull --ff-only origin review/p231-appcheck-runtime-readiness
node --check audit/fast-track-full-public/gate-a-browser-mocked-smoke.cjs || exit 1
python3 -m py_compile audit/fast-track-full-public/gate-a-browser-mocked-smoke.py || exit 1
python3 -B audit/fast-track-full-public/gate-a-browser-mocked-smoke.py
echo "PACKTOOK_GATE_A3_EXIT=$?"
```

If package is absent, return **4 BLOCKED_PLAYWRIGHT_NOT_INSTALLED** with no attempted runtime. If Chromium is missing, test is expected to fail with a sanitized browser exception; do not call it a candidate failure. Install browser tooling only in a separately approved machine/dev container, not on a production system. Do not auto-download browsers from an uncontrolled source.

**Caveats:** The mock succeeds only for the guarded Bridge and current index startup behavior; external network policy may reveal other dependencies to evaluate. A mock App Check `initializeAppCheck` call does not prove real SDK token attachment, reCAPTCHA domain registration, Auth enforcement or callable backend behavior. A3 requires reviewer acceptance of limitations, and Gate B separately requires exact candidate on approved registered origin and fresh authorization.

Gate A still BLOCKED. All production/public signup changes are prohibited until explicitly approved.
