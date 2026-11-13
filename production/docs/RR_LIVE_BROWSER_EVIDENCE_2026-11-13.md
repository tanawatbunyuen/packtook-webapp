# Verified LIVE Staging Browser + App Check Bridge Source Audit
Date: 2026-11-13 (Asia/Bangkok)
Workflow run: https://github.com/tanawatbunyuen/packtook-webapp/actions/runs/43463434918

## Real headless Chromium results
- BROWSER_LIVE_LOGIN_LAYOUT: PASS
- BROWSER_FIREBASE_BRIDGE_READY: PASS
- BROWSER_UNAUTHENTICATED_ROUTE: PASS
- LIVE_BRIDGE_FIREBASE_AUTH_AND_FUNCTIONS_IMPORTS: PASS
- BROWSER_PUBLIC_READ_ONLY: PASS
- LIVE_BRIDGE_APPCHECK_INTEGRATION: PRESENT_SOURCE_HINT
- LIVE_FIREBASE_APPCHECK_IMPORT: YES
- LIVE_INITIALIZE_APPCHECK: YES
- LIVE_RECAPTCHA_PROVIDER: YES
- LIVE_APPCHECK_TOKEN_GET: YES
- LIVE_BRIDGE_EQUALS_REPO: NO

## Important release drift finding
The live deployed Staging Firebase bridge **does NOT match** the checked-out repository bridge.
- Live bridge SHA256: `f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605`
- Branch repository bridge SHA256: `dbe63ea569d6fb0c006d0cf8a5a2756311355bf6cbfbc8923376dc0058ac73dd`

This likely explains why earlier static repository inspection did not find App Check initialization while live staging served an App Check implementation. **Do not overwrite deployed Staging with older GitHub branch without a reviewed deployment diff and provenance check.**

## Still NOT verified
- No Owner authenticated sign-in or Owner custom claims were tested; the screenshot exposed a password, so rotate it privately before using the account again.
- Source-level App Check initialization does **not** prove valid registered attestation or limited-use replay rejection by backend.
- Omise Test Mode actual read-only GET is not executed; isolated staging credentials and approved test charge still unavailable here.
- No production deployment, no public enablement, no human Security/Finance/Legal signoff, no production pilot or rollback was performed.

**Decision: browser public smoke PASS, runtime source drift BLOCKER, App Check/Omise true end-to-end NOT YET VERIFIED, NO_GO_RELEASE.**
