# P231.157 — Versioned staging JavaScript asset integrity inventory

## Operator-confirmed P231.156 result
`P231_INDEX_EXACT_PARITY=NO`, `P231_INDEX_PARITY_AFTER_SCRIPT_VERSION_NORMALIZATION=YES`, five versioned scripts on both sides, script basename order match, and `P231_INDEX_DRIFT_CLASSIFICATION=ONLY_SUPPORTED_SCRIPT_VERSION_QUERIES`. Exit 0.

This proves only that the complete index text is identical after normalizing the supported script `?v=` strings. It does not prove any of the JS files themselves match, nor that the version queries are functionally interchangeable. Bridge and Config parity remain open.

## P231.157 audit
`audit/p231/isolated-test/p231157-staging-js-asset-integrity-readonly.py` uses only an explicit allowlist of the five scripts referenced by the staging `index.html`:
- `firebase-packing-bridge.js`
- `video-history-db.js`
- `video-stream-writer.js`
- `performance-monitor.js`
- `app.js`

The script validates **both** local and hosted Index script inventories, then checks **actual UTF-8 file content equality** for each local JS file vs the public hosted JS file. It also flags whether the Index version query for each asset matches, but prints no values. It never prints source code, site keys, account identifiers or credential data. The HTTP requests are static GETs to the public Hosting site only; no Firebase Auth/App Check token issuance, Functions calls, IAM/Firestore writes or deployments.

`P231_ASSET_CONTENT_DRIFT_COUNT` is an inventory count, not an exploit score. Exit 0 means all assets were readable and compared successfully; individual `DRIFT` results may still require reconciliation. Any unavailable asset exits 2. Deployment is **BLOCKED** regardless of audit outcome, pending reviewed canonical source and key provisioning, testing, rollback and explicit staging-only authorization.

## Cumulative
P231.132 isolated HTTP E2E 3/3 PASS; static fixtures 9/9 PASS; P231.149 App Check and Auth headers observed on normal client; P231.150 normal `usageStatus` HTTP 200 observed; P231.152 public-key candidate PASS_MEMORY_ONLY; P231.151 deploy safety gate BLOCKED as designed; P231.156 Index version-only normalization PASS. Strict isolated request-level diagnostic tracing remains INCONCLUSIVE 1/2. Production remains NO_GO.

P231157_JS_ASSET_INVENTORY=COMMITTED_AWAITING_RESULT
P231157_DEPLOY=NOT_PERFORMED
P231157_RELEASE=NO_GO
