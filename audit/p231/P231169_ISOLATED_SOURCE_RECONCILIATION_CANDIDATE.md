# P231.169 — Isolated source reconciliation candidate

## Observed P231.168 evidence
The owner reported `P231168_ASSET_PARITY_EXIT_CODE=0`, 12 local Hosting files read and compared against current public staging assets; **9 byte-matched, 3 drifted, 0 unavailable**. No *other* local asset besides the known `index.html`, `firebase-v4-config.js`, and `firebase-packing-bridge.js` had a content mismatch. This is one-way local-to-public parity; hosted-only files remain unenumerated and Firebase CLI packaging remains unverified.

The specific prior finding P231.156 established exact `index.html` equality after normalizing only supported script `?v=` queries. P231.157 established all other four versioned JS assets match exactly. P231.164 validated a staging live Hosting release/version pin, but rollback execution is not verified.

## P231.169 candidate experiment
`audit/p231/isolated-test/p231169-isolated-reconciliation-candidate.py` builds a **temporary, non-deploying** candidate copy:
1. Confirm local Hosting public directory and ignore patterns.
2. Fetch only the *public* hosted staging Index/Config/Bridge static assets.
3. Require local/hosted Index equality after strict version-query normalization, and that both configs explicitly identify `packtook-staging`.
4. Extract the **public** reCAPTCHA Enterprise site key from the already-operational hosted staging bridge without logging or committing it. Inject it into a temporary copy of local config; never modify repository config.
5. Copy the hosted **Index only** to align script version references. Preserve reviewed **local Bridge** including `protectedApi` guarded status calls, and preserve all four other JS assets unchanged.
6. Run 10 boolean static tests on the transient candidate, log only pass/fail flags and counts, then discard the candidate automatically.

This candidate intentionally retains Bridge and Config source-byte drift relative to hosted staging, since canonical code can legitimately be different while keeping the already-verified App Check behavior. **This is not proof of runtime compatibility, deployment safety, or a reproducible persistent Hosting artifact**. The script does no API calls to Firebase Auth, App Check, Functions, Firestore, IAM, or billing.

## Next step
The meaningful engineering gate after a 10/10 static pass is to validate the exact candidate's behavior in a separate, authorized staging test environment before Hosting deployment. An offline static check does not prove that the hosted App Check initialization and SDK token attachment remain operational in a different Bridge implementation. We must also establish a full artifact hash and supported rollback procedure before an approved staging-only Hosting release. Keep production NO_GO and public signup closed.

P231169_CANDIDATE=PREPARED_FOR_OPERATOR_STATIC_TEST
P231169_HOSTING_DEPLOY=BLOCKED
P231169_RELEASE=NO_GO
