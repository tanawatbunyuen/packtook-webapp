# P231.106 — Anonymous request rejected; App Check E2E not yet tested

2026-11-26. Operator reported P231.105:
- P231_PRE_REQUEST_DIRECT_PRIVATE_POLICY=PASS
- P231_ANONYMOUS_HTTP_STATUS=403
- P231_ANONYMOUS_IAM_DENIAL=HTTP_REJECTED
- P231_BEARER_TOKENS=NONE_SENT
- P231105_HTTP_DENIAL_EXIT_CODE=0
- P231_APP_CHECK_E2E=NOT_TESTED
- P231_IAM_WRITES=0; P231_DEPLOY=NOT_PERFORMED; P231_CLEANUP=NOT_PERFORMED; P231_RELEASE=NO_GO

Interpretation: anonymous HTTP POST was rejected 403; consistent with Cloud Run private invocation, especially given prior direct/inherited IAM checks. HTTP status alone cannot conclusively identify exact denial component without service log correlation. It does **not** prove `enforceAppCheck:true` rejects invalid/missing App Check after IAM and Firebase Auth succeeds.

## Credential prerequisites to be verified, not supplied by the audit
1. Active operator Google Cloud identity token with audience exactly the Cloud Run service URL, supplied only at invocation time; do not print/store bearer tokens.
2. Synthetic staging Firebase Auth user (email verified) with valid ID token, intentionally separate from Google Cloud IAM credential. No production user/customer credential.
3. Legitimate Firebase App Check token for the staging Firebase app (not hand-created, forged or placeholder), with enabled/authorized attestation provider, and matching app registration. Verify generation method and expiration separately; do not log token value.
4. Explicit identity-token routing for callable with both auth systems: Cloud Run identity token in `X-Serverless-Authorization`, Firebase Auth ID token in `Authorization`, App Check token in `X-Firebase-AppCheck`. Validate runtime behavior rather than assuming.
5. Same deployed function, revision, method and payload across VALID/MISSING/MALFORMED App Check scenarios. Ensure malformed token cannot accidentally be used as identity credential.
6. Before execution, rerun private IAM audit and enforce user-approved 2026-11-26 Bangkok timebox. If valid staging App Check token is unavailable, stop instead of faking success. Retain and separately approve cleanup.

## Next stage
P231.106 read-only prerequisites check: examine project, function/service metadata, configured App Check apps *only if accessible*; do not obtain credentials, print user IDs or tokens or invoke service. Never modify existing functions, IAM, signup or production.

P231_ANONYMOUS_HTTP_DENIAL=PASS_OPERATOR_REPORTED
P231_PRIVATE_IAM=STRUCTURAL_PASS_AND_ANONYMOUS_REJECT
P231_VALID_STAGING_APPCHECK_TOKEN=NOT_VERIFIED
P231_AUTH_USER=NOT_VERIFIED
P231_APP_CHECK_E2E=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
