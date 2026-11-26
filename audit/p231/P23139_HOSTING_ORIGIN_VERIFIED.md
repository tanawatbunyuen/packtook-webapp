# P231.39 — Hosted origin, MIME and response provenance (operator-reported)

Recorded 2026-11-26. Browser origin: `https://packtook-staging.web.app`, path `/`. Requests were read-only same-origin `fetch` with `cache:no-store`, `credentials:omit` and no Cloud Functions calls.

| URL path | HTTP | Final host | Redirect | Content-Type | Byte count | Browser SHA256 (P231.35) |
|---|---|---|---|---|---|---|
| /firebase-packing-bridge.js | 200 | packtook-staging.web.app | false | text/javascript; charset=utf-8 | 4730 | f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605 |
| /firebase-v4-config.js | 200 | packtook-staging.web.app | false | text/javascript; charset=utf-8 | 493 | ae4426565f6c2cc45df6010089856c07fdda84f54849c797b29aaf1219ae19f9 |

The config file was **not classified** as a nonempty or empty site-key literal by the limited browser regex. This is not evidence of key absence. GitHub branch `firebase-staging/firebase-v4-config.js` was previously found to declare an empty site key; the browser served content differs by SHA256. Notably GitHub root `firebase-v4-config.js` is approximately 493 characters (separate file), but matching length is **not evidence of matching bytes**. Establish exact Hosting release and source origin before attributing drift.

## Next safe checks
1. Read-only classify downloaded bridge imports, App Check SDK/provider/initialize markers, and config export names **without printing token, site key, config values, API key or source body**.
2. Establish whether `accountRole` sends the App Check header on an existing authenticated browser request; do not force writes or recordingStatus operations.
3. Pin Hosting release ID, deploy history and source provenance before staging deployment. The live staged app may differ from the review branch. No automatic rollback or source replacement.

P231_HOSTING_ORIGIN=packtook-staging.web.app
P231_HOSTING_RELEASE=NOT_PINNED
P231_CONFIG_SITE_KEY=UNDETERMINED
P231_CLIENT_SOURCE_PARITY=MISMATCH_0_OF_2
P231_APP_CHECK_RUNTIME=NOT_VERIFIED
P231_STAGING_DEPLOY=NOT_PERFORMED
P231_PRODUCTION_DEPLOY=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
