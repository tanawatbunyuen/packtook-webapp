# P231.120 — Compare hosted literal to App Check registered Enterprise site key

Operator result P231.119: exactly one constructor and `P231_PROVIDER_ARGUMENT_CLASS=NONEMPTY_STRING_LITERAL`, exit 0. No keys were printed; browser attestation, valid App Check token, and E2E remain unverified.

P231.120 read-only script GETs only the hosted staging bridge and the Firebase App Check Enterprise config for the ONE staging Web App. It uses `X-Goog-User-Project: packtook-staging`, as required to resolve the prior 403. Site keys are compared only in process memory; neither raw key, API response, hosted source, OAuth token nor key hash is printed, written to disk, or committed. The script does not invoke any Cloud Function.

Reported results:
- `MATCH`: hosted static literal exactly equals registered Enterprise site key. This proves textual equality, not domain allowlist, provider attestation, issued tokens, or Runtime App Check enforcement.
- `MISMATCH`: key differs; block active E2E, propose staging-only change for owner review, never change automatically.
- `PREREQUISITES_UNAVAILABLE` / `NOT_SIMPLE_LITERAL`: inconclusive rather than PASS.

No IAM/Hosting/Function/provider writes; no deployments or cleanup. Real E2E remains approval gated by the original 2026-11-26 Bangkok testing timebox, and future deployment/cleanup require their own authorization.

P231_HOSTED_REGISTERED_SITE_KEY=AWAITING_RESULT
P231_BROWSER_ATTESTATION=NOT_PERFORMED
P231_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED