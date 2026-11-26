# P231.152 — Staging Hosting candidate design and in-memory safety preflight

## P231.151 operator-confirmed results
- P231_HOSTING_PUBLIC_DIRECTORY=EXPECTED_STAGING
- P231_BRIDGE_SOURCE_PARITY=DRIFT
- P231_CONFIG_SOURCE_PARITY=DRIFT
- P231_INDEX_SOURCE_PARITY=DRIFT
- P231_LOCAL_SITE_KEY_EXPORT=EXPORT_EMPTY
- P231_HOSTED_SITE_KEY_EXPORT=NOT_EXPORTED
- P231_LOCAL_HAS_PROTECTED_STATUS_WRAPPER=YES
- P231_HOSTED_HAS_PROTECTED_STATUS_WRAPPER=NO
- P231_HOSTED_PROVIDER_LITERAL_PRESENT=YES
- P231_UNRECONCILED_DEPLOY_GATE=BLOCKED
- P231151_PREDEPLOY_EXIT_CODE=3 (**expected safe refusal**)
- Cloud writes 0, no deploy, no cleanup, release NO_GO.

The repository Hosting directory is `firebase-staging`. A blind deploy would publish files whose bridge/config/index differ from the currently functional hosted staging site, and the checked-in App Check site-key export is empty.

## P231.152 next safe increment
Added `audit/p231/isolated-test/p231152-candidate-memory-preflight-readonly.py`. It reads local `firebase-staging` bridge/config/index and fetches only the corresponding **public** hosted static files. The tool extracts the public staging Enterprise *site key* from the hosted `ReCaptchaEnterpriseProvider` constructor **only into local Python memory**. Site keys are public client configuration, not service account credentials; the tool nevertheless never prints, writes or commits the value.

In memory it replaces exactly one empty `recaptchaEnterpriseSiteKey` export in the **candidate** copy of the local config; the repository files remain unmodified. Candidate bridge retains fail-closed status calls, `initializeAppCheck`, same-app `getFunctions`, and auto-refresh. It reports boolean static checks and whether the candidate bridge/config/index matches hosted assets. The candidate is **not built, saved, or deployable**. This deliberately prevents mistaking a public-key substitution alone for full reconciliation, because hosted bridge and index drift still exist.

Expected under current evidence:
- `P231_CANDIDATE_STATIC_SAFETY=PASS_MEMORY_ONLY`
- `P231_HOSTED_PARITY=DRIFT_REMAINS`
- `P231_DEPLOY_READINESS=BLOCKED_PENDING_ASSET_RECONCILIATION_AND_APPROVAL`
- `P231_RELEASE=NO_GO`

## Remaining work before ANY staging Hosting deployment
1. Inspect the exact changes among hosted vs local bridge, config, and index under an offline review/PR process, preserving known-good application behavior and version provenance.
2. Determine intended canonical client source and a reproducible, reviewed environment-specific site-key injection mechanism. Use a staged build artifact and immutable manifest; verify app ID, domain allowlist, expected Functions region and missing-key fail-closed.
3. Validate the complete Hosting artifact with automated static tests and independent staging smoke checks, including normal-client App Check header attachment, without exposing tokens.
4. Obtain explicit staging Hosting deploy authorization and maintain a rollback artifact before performing any writes. **No authorization is inferred from running this dry-run.**
5. Keep public signup closed and production NO_GO; billing, PDPA, monitoring and owner release approvals remain separate.

No IAM changes, Firestore changes, function invocations, production writes, Hosting deploy, cleanup or new Auth/App Check token requests are performed in this phase.

P231152_CANDIDATE=MEMORY_ONLY_PREPARED
P231152_HOSTING_DEPLOY=BLOCKED
P231152_RELEASE=NO_GO
