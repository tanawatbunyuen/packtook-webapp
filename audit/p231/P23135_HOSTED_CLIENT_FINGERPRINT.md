# P231.35 — Hosted staging client fingerprint (operator-reported)

Date: 2026-11-26. Browser Console fetched same-origin resources with cache `no-store`. These SHA256 values reflect fetched responses, **not yet pinned Hosting release**.

| Path | SHA256 (browser observed) |
| --- | --- |
| `firebase-packing-bridge.js` | `f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605` |
| `firebase-v4-config.js` | `ae4426565f6c2cc45df6010089856c07fdda84f54849c797b29aaf1219ae19f9` |

Browser source-marker findings: `initializeAppCheck` FOUND in bridge, `accountRole` uses standard SDK wrapper, `recaptchaEnterpriseSiteKey` parser UNDETERMINED, no Cloud Functions calls.

GitHub branch source inspection establishes `firebase-staging/firebase-packing-bridge.js` imports/initializes App Check conditionally on a nonempty key and calls `usageStatus`, `recordingStatus` through `protectedApi`; `accountRole` via `api`. `firebase-staging/firebase-v4-config.js` has **empty site key**, whereas browser request previously had `X-Firebase-AppCheck`. This is a potential release/source parity mismatch; no conclusion about exact byte drift until comparing SHA256 with local checkout, MIME type, and deployment hosting site.

## Next actions (read-only)
- Compare browser SHA256s to GitHub branch file SHA256s calculated with `sha256sum`, **not Git blob SHA1**.
- Establish browser response MIME type, actual URL/path, projectId and site-key classification (PRESENT/EMPTY/UNDETERMINED) without printing site key, auth tokens, or config.
- Check actual `accountRole` fetch POST has `X-Firebase-AppCheck` and Authorization headers (presence only); no need to trigger recordingStatus/credit usage.
- Pin Hosting release provenance and isolate runtime test; no staging deploy without approval.

`P231_HOSTING_SOURCE_PARITY=NOT_VERIFIED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
