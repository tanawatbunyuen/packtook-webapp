# P231.93 — Private invoker and cleanup permission result (READ ONLY)

Recorded: 2026-11-26. Results supplied by staging Cloud Shell operator (not independently queried via GCP).

- `P231_ACTIVE_OPERATOR=ONE_ACCOUNT`, `P231_OPERATOR_IDENTITY_TYPE=USER_OR_FEDERATED`, `P231_ACTIVE_PROJECT=STAGING`.
- Project `:testIamPermissions` returned `ALLOWED_AT_PROJECT` for: `run.services.get`, `run.services.getIamPolicy`, `run.services.setIamPolicy`, `run.routes.invoke`, `cloudfunctions.functions.get`, `cloudfunctions.functions.delete`, and `run.services.delete`.
- `P231_PERMISSION_PROBE=READ_ONLY_COMPLETE`, `P231_READONLY_EXIT_CODE=0`.
- `P231_OPERATOR_INVOKER_CANDIDATE=ACTIVE_OPERATOR_NOT_APPROVED`.
- `P231_NEW_SERVICE_IAM=NOT_EXISTING_NOT_VERIFIED`, `P231_SERVICE_LEVEL_INVOKER_GRANT=NOT_PERFORMED`.
- `P231_CLEANUP_SCOPE=NEW_P231_FUNCTION_ONLY`, `P231_CLEANUP_TIMEBOX=PROPOSAL_SAME_DAY_NOT_APPROVED`.
- `P231_IAM_WRITES=0`, `P231_DEPLOY=NOT_PERFORMED`, `P231_RUNTIME_APPCHECK=NOT_VERIFIED`.

## Security interpretation

This is evidence of seven *project-scoped* permission checks for the active operator. It does not establish IAM access on a nonexistent Cloud Run Service, nor a service-specific invoker binding. It also does not mean approval to deploy or delete.

P231.89 approval allowed **preparation** of the isolated deployment subject to IAM, actAs, Private Invoker and Cleanup gates; it did not authorize bypassing open gates. P231.92 explicitly requested READ-ONLY review and no IAM edit or deployment. Accordingly no further cloud mutation is authorized.

## Next decisions

1. Confirm the existing active operator principal may receive `roles/run.invoker` **on the one new Cloud Run Service only**, with no public principal or project-wide grants. Its actual identity can be selected locally and verified without posting email/account identifiers or tokens.
2. Approve a **fixed expiry and same-day cleanup procedure**, with a named owner and explicit confirmation before destructive cleanup. Delete only the new P231 function after verifying identity/revision; do not delete any existing staging function or shared asset. Revoke only the service-level test invoker grant if introduced.
3. Approve a staged-only **new-function deployment** after a final immutable source hash and selector audit; never run bulk deploy or `--force`.
4. Immediately after deploy, before invocation, confirm private Invoker IAM effective and runtime service account; abort any test call if unexpectedly public.
5. App Check E2E later: VALID / MISSING / MALFORMED with synthetic verified Firebase Auth test user and a scoped Google Cloud IAM caller, no token logging.

## Status

P231_OPERATOR_PERMISSION_PROBE=7_OF_7_ALLOWED_AT_PROJECT
P231_SERVICE_LEVEL_INVOKER=NOT_VERIFIED
P231_INVOKER_PRINCIPAL_APPROVAL=NOT_GIVEN
P231_CLEANUP_TIMEBOX=NOT_APPROVED
P231_STAGING_NEW_FUNCTION_DEPLOY=NOT_AUTHORIZED
P231_DEPLOY=NOT_PERFORMED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
