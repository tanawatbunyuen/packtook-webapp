# P231.49 — Published bridge not found in inspected Git history

Date: 2026-11-26, operator-reported read-only Cloud Shell result.

- Hosted bridge SHA256: `f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605` (4,730 bytes).
- Search used `git clone --no-single-branch`, inspected `git log --all` contents for paths `firebase-packing-bridge.js` and `firebase-staging/firebase-packing-bridge.js` and SHA256 compared; 21 commit/path observations scanned, 0 exact matches.
- Hosted config SHA256 `ae4426565f6c2cc45df6010089856c07fdda84f54849c797b29aaf1219ae19f9` matches repository root `firebase-v4-config.js`, not `firebase-staging/firebase-v4-config.js`.
- Hosting version `840e12c0c88d8c1c` manifest contains bridge/config/index, but manifest hashes not established as byte-identical to browser decoded content SHA256.

Limitations: Git history scan does not cover external artifacts, deleted/unreachable commits, alternative source paths, or build pipeline transformations. NO proof of unauthorized modification.

Next: examine served bridge locally in browser by *structural classification only*, without printing source bodies, embedded literals, provider keys, secrets or token values. Specifically check which module it imports for config, the argument shape of ReCaptchaEnterpriseProvider, and whether the literal exported `recaptchaEnterpriseSiteKey` name is required. Prefer safe read-only output. Establish actual Hosting artifact provenance and client compatibility before any staging patch deployment.

P231_HISTORICAL_MATCH=NOT_FOUND
P231_COMMITS_CHECKED=21
P231_MATCH_COUNT=0
P231_BRIDGE_SOURCE_PROVENANCE=UNRESOLVED
P231_APP_CHECK_RUNTIME=NOT_VERIFIED
P231_DEPLOY=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
