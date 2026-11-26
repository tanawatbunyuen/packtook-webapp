# P231.159 — Transient staging Hosting candidate and offline tests

## P231.158 verified preflight
Operator reported `P231158_OFFLINE_GATE_EXIT_CODE=3` as the expected safe refusal. Firebase Hosting public directory and all five versioned JS asset references were confirmed, staging project/region and App Check status guard were found, while the repository's public Enterprise site-key export remained empty. No built artifact, no runtime smoke or deploy.

## P231.159 implementation
`audit/p231/isolated-test/p231159-transient-candidate-offline-test.py` builds a **temporary test copy** of `firebase-staging` using Python `TemporaryDirectory`. It reads the registered staging client public reCAPTCHA Enterprise site-key shape from the known hosted staging bridge and validates hosted staging project config via **public static GET** requests. The public site key is written **only to the transient candidate's** `firebase-v4-config.js`; it is never printed, sent to a server, committed to Git, or copied into the source tree.

The temporary candidate is checked for:
- Exactly five expected versioned scripts present in Index.
- All five JS asset files exist.
- Public site-key export is nonempty in the candidate.
- Staging project and Functions same-app/region preserved.
- App Check Enterprise initialization and auto refresh preserved.
- Protected `usageStatus` and `recordingStatus` fail-closed guard preserved.
- Bridge and Index identical to the Git-reviewed source.
- Four unrelated JS assets byte-identical to Git-reviewed source.

After the checks, `TemporaryDirectory` discards the **local transient test copy** automatically. This is not a deployable artifact and there is no cloud cleanup. The script prints only boolean flags and a test count, not the key value or source.

## Limits and release decision
An offline candidate passing 10/10 structural assertions does **not** resolve live hosted source/config/index parity, prove runtime behavior of the generated candidate or authorize deploy. P231.157 verified four unrelated JS assets match Hosted; the bridge content/version and config still differ and remain unresolved. P231.156 proved local/hosted Index differ only by supported script version queries. Source reconciliation and a rollback/release manifest remain necessary.

Prior normal-client `usageStatus` App Check and Auth header presence + HTTP 200, isolated staging E2E 3/3, static 9/9, strict trace correlation 1/2 INCONCLUSIVE all remain as recorded. Public signup closed, production NO_GO.

P231159_CANDIDATE_TEST=PREPARED_AWAITING_RESULT
P231159_PRODUCTION_RELEASE=NO_GO
