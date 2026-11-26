# P231.47 — Hosted source provenance: root config MATCH, bridge unmatched

Date 2026-11-26. User-supplied read-only SHA256 comparisons, Hosting version `840e12c0c88d8c1c` (release 2026-11-08T08:05:29.869Z).

| File | Browser SHA256 | GitHub root SHA256 | GitHub firebase-staging SHA256 | Result |
|---|---|---|---|---|
| firebase-v4-config.js | ae4426565f6c2cc45df6010089856c07fdda84f54849c797b29aaf1219ae19f9 (493 bytes) | ae4426565f6c2cc45df6010089856c07fdda84f54849c797b29aaf1219ae19f9 (493 bytes) | e02e95a6234fb7506c27c7c315bbabf25057f46e3c2477042c56f99d9d2f0155 (770 bytes) | Root MATCH |
| firebase-packing-bridge.js | f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605 (4730 bytes) | 83407ad472c9f6b0715fb3df16efdf7d5f12ca0da3e49caf48ad6e38adb72cff (1454 bytes) | b92bbb157700a4f8dd64e5d6de65d07f22f566c0b747cba01dc7af994ea5db63 (4992 bytes) | Neither MATCH |

Website served config therefore matches the repo root file exactly, but its bridge is not equal to the currently checked ref's root or firebase-staging candidate. Operator reports App Check header present on usageStatus despite no declared recaptchaEnterpriseSiteKey in served config, so bridge may acquire a key through a different source or different code version; **do not infer mechanism**.

Next: search git history for `firebase-packing-bridge.js` content hash in both paths without displaying source or credentials; if not found, investigate Hosting version file provenance and deployment pipeline using authorized read-only access. Client App Check enforcement remains unverified. Do NOT deploy historic source or config. No tokens or key contents in logs.

P231_CONFIG_ROOT_PARITY=MATCH
P231_BRIDGE_PARITY=UNRESOLVED
P231_HOSTING_RELEASE=840e12c0c88d8c1c
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_STAGING_DEPLOY=NOT_PERFORMED
P231_PRODUCTION_DEPLOY=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
