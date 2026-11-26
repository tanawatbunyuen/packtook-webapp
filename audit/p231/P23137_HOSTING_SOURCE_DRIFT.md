# P231.37 — Hosted client / GitHub source SHA-256 mismatch

Recorded: 2026-11-26; operator-supplied read-only output. Environment believed to be packtook-staging; exact browser origin, Hosting release and request URL still need pinning.

| file | GitHub branch SHA256 | Browser fetched SHA256 | match |
|---|---|---|---|
| firebase-packing-bridge.js | b92bbb157700a4f8dd64e5d6de65d07f22f566c0b747cba01dc7af994ea5db63 | f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605 | NO |
| firebase-v4-config.js | e02e95a6234fb7506c27c7c315bbabf25057f46e3c2477042c56f99d9d2f0155 | ae4426565f6c2cc45df6010089856c07fdda84f54849c797b29aaf1219ae19f9 | NO |

GitHub ref: review/p231-appcheck-runtime-readiness. 0/2 matched. Browser operator script fetched relative paths via URL(name, location.href), cache no-store, credentials omit. Validate resolved URL, response type, redirect history and exact Hosting release before attributing mismatch. Do not print site key, Authorization, App Check tokens or full config to chat. The GitHub branch staging config had an empty site key, while operator previously observed an App Check header from browser; this may reflect different deployed sources or other configuration.

Next gate: fingerprint response URL / content-type; compare to pinned Hosting versions and establish deployment provenance. Do not deploy the empty-key branch to live staging. No user data or production actions.

P231_SOURCE_PARITY=MISMATCH_0_OF_2_OPERATOR_REPORTED
P231_HOSTING_RELEASE=NOT_PINNED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_STAGING_DEPLOY=NOT_PERFORMED
P231_PRODUCTION_DEPLOY=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
