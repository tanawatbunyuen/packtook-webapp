# P231.43 — Hosting live release pin (operator-reported)

Recorded: 2026-11-26. Source: operator-issued read-only Firebase Hosting releases API request (HTTP 200) to `sites/packtook-staging/releases?pageSize=100`. 41 release entries in the returned page, with latest observed unchanneled release:

- Site: `packtook-staging`
- Latest release: `sites/packtook-staging/releases/1794125129869000`
- Hosting version: `sites/packtook-staging/versions/840e12c0c88d8c1c`
- Release UTC: `2026-11-08T08:05:29.869Z`
- Type: `DEPLOY`
- Previous version: `a91ba2b324621d52` released `2026-11-07T13:43:10.123Z`
- Earlier versions: `aeb332d5dac03b4b`, `fb676cf0ad0e4f01`, `9f85d008955957a4`.
- Fingerprints from browser and source branch remain mismatch 0/2 (see P231.37 and P231.39).

**Caution:** Listing latest release metadata does not establish exact file-bytes parity with browser response. Next step: read-only Hosting API `sites/packtook-staging/versions/840e12c0c88d8c1c/files` for the exact paths and file hash; Hosting manifest hashes represent hashes of gzip-uploaded artifacts, **not necessarily SHA256 of decompressed browser-served JavaScript**; do not directly compare them as equal or report mismatch on that basis. Pagination must be handled.

Gates: `P231_HOSTING_RELEASE_PIN=OPERATOR_REPORTED`; `P231_HOSTING_MANIFEST=NOT_CHECKED`; `P231_RUNTIME_APPCHECK=NOT_VERIFIED`; `P231_RELEASE=NO_GO`; `PUBLIC_SIGNUP=KEEP_CLOSED`. No staging or production deployment.
