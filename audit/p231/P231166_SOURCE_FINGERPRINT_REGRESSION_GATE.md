# P231.166 — Offline source fingerprint regression gate

## Operator-confirmed P231.165
The user reported `P231165_INTEGRITY_EXIT_CODE=0` and non-config repository source SHA-256 `62b0608c2b617f9dcd30c6a06fed78c7b62301f52cd5064ff8624d8633224bc4`, calculated from six staging Hosting source files in a deterministic filename/length/content concatenation format.

That inventory intentionally **excluded `firebase-v4-config.js`**, where the checked-in staging public Enterprise site-key export is empty. It is a **source regression baseline**, not a complete candidate image, not a backup, and not release or rollback evidence.

P231.164 pin was previously validated against the current live Hosting channel, but P231.165 did not recheck channel freshness; independent metadata revalidation is required before any future deploy.

## P231.166 implementation
`audit/p231/isolated-test/p231166-offline-source-fingerprint-regression.py` reproduces the exact hash calculation and checks it matches the operator-confirmed P231.165 baseline. It independently validates local manifest shape (five expected versioned scripts), Hosting public directory, staging live release pin scope and lack of deployment authorization. It also asserts the checked-in site-key export remains empty to avoid silently treating an unreviewed source modification as a reviewed build.

Expected:
- `P231_FINGERPRINT_PARITY=MATCH`, exit 0 means the **reviewed six-file local source baseline is still intact**.
- `P231_FINGERPRINT_PARITY=DRIFT`, exit 3 stops the candidate pipeline pending source review.
- Missing or unexpected inputs exit 2. Neither exit 0 nor any output grants Hosting deployment approval.

The next engineering activity is not another metadata-only loop: prepare a fully isolated, *persistent but non-deploying* Hosting candidate artifact from a reviewed source and staging-only public-key provisioning, with manifest covering **all Hosting files**, artifact digest without leaking key material, and defined runtime smoke/rollback checks. Do not create/release that build by auto-copying the current hosted Bridge without reviewing code differences. Current Hosted Bridge/Config/Index drift remains; four other JS assets match.

## Scope
No network calls, Firebase Auth/App Check issuance, Business API, Firestore, IAM, file modifications, deployment, rollback execution or public signup changes. Production NO_GO, Hosting deployment blocked.

P231166_FINGERPRINT_GATE=PREPARED_AWAITING_OPERATOR_RESULT
P231166_STAGING_DEPLOY=BLOCKED
P231166_RELEASE=NO_GO
