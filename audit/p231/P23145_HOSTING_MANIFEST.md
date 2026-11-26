# P231.45 — Firebase Hosting version file manifest evidence

Recorded 2026-11-26, operator-supplied read-only Firebase Hosting API results.

- Site: `packtook-staging`
- Release: `sites/packtook-staging/releases/1794125129869000`
- Version: `sites/packtook-staging/versions/840e12c0c88d8c1c`
- Files API: PASS; total 19 reported files in manifest.
- `/firebase-packing-bridge.js`: ACTIVE; hosting manifest hash `6457f1f062e69e8cea3b167c0c1f48074be189d8690ccde9ef06b57576824444`
- `/firebase-v4-config.js`: ACTIVE; manifest hash `620adb5d8404ab1fd60559f5e80071bcac64f7f1f092819ac67b8dc199d51d17`
- `/index.html`: ACTIVE; manifest hash `844ba2e08f31309650ed10c7c122bbc0acd5c9bf93fa1ff57eb631cf3e9459e5`

The manifest hash is an artifact-level hash; it is not yet established as directly comparable with SHA256 over browser-downloaded decoded source bodies. Prior browser SHA256 and GitHub staging-directory source SHA256 differ for 2/2 files (P231.37). The browser-reported config byte length is 493 bytes; GitHub repository has a distinct root `firebase-v4-config.js` source file of similar length. Compare exact SHA256 of both root and staging-directory variants before attributing the source mismatch to deployment process.

Required next: read-only compare all candidates (root vs firebase-staging) with browser hashes and inspect Hosting version release provenance. Do not fetch or paste auth tokens or full config values. No IAM edit, no production or staging deployment.

P231_HOSTING_VERSION_MANIFEST=PASS
P231_HOSTED_BYTES_VS_MANIFEST=NOT_VERIFIED
P231_SOURCE_PARITY=NOT_RESOLVED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
