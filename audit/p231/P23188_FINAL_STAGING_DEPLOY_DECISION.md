# P231.88 — Final staging deployment decision (NOT AUTHORIZED)

2026-11-26. Operator reported:
- P231_ACTIVE_OPERATOR=ONE_ACCOUNT
- P231_RUNTIME_SA=READABLE
- cloudfunctions.googleapis.com, run.googleapis.com, cloudbuild.googleapis.com, artifactregistry.googleapis.com: ENABLED
- P231_OPERATOR_EFFECTIVE_DEPLOY_PERMISSION=NOT_TESTED
- P231_OPERATOR_ACT_AS_PERMISSION=NOT_TESTED
- P231_INVOKER_IDENTITY=NOT_SELECTED
- P231_PREFLIGHT_EXIT_CODE=0
- P231_IAM_WRITES=0; P231_DEPLOY=NOT_PERFORMED; P231_RUNTIME_APPCHECK=NOT_VERIFIED

## Scope for the NEXT explicit approval
**Proposed action:** deploy ONE new, isolated Gen2 staging callable, `p231AppCheckIsolatedProbe` in `asia-southeast1`, using source from `audit/p231/isolated-test/` and isolated `p231-isolated` codebase in fresh temporary Firebase configuration. Use dedicated staging runtime SA `p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com`; enforce App Check; private invoker. No customer/Firestore/payment/credit access.

**Out of scope:** production project, public signup changes, updates/deletes of any existing function, project-wide invoker roles, allUsers or allAuthenticatedUsers invoker grants, modifying Firebase Hosting, Firestore, or IAM for unrelated principals, force deploys, and any automatic cleanup of other resources.

**Required before actual deploy (must be done after approval and with an appropriately privileged operator):**
1. Freeze exact source commit and inspect approved isolated deployment directory, config and function export. Inspect installed Firebase CLI version and `firebase deploy --help` to validate narrow codebase selector syntax; never assume.
2. Verify operator can deploy the new function and actAs dedicated runtime SA; no broad grants or privilege escalation as a workaround. Developer role and service agents may require additional project-level capabilities; treat permission errors as blockers.
3. Verify private invoker mode will actually be honored: after deployment, audit newly created Cloud Run service policy and `invokerIamDisabled` settings before any invocation, and abort if public. Explicitly consider inherited IAM.
4. Select an approved invoking principal with service-only `roles/run.invoker` (requires separate approval) and a separate verified Firebase Auth staging user. Never log any bearer token values.
5. Prepare fixed 3-case E2E (valid / missing / malformed App Check) against exact same endpoint, authentication context and deployed revision. Differentiate IAM denial, callable authentication denial and App Check token denial.
6. Before deploy, approve resource expiry, cost/log budgets, manual deletion target, and rollback mechanics; no broad delete. Existing services must remain untouched.

**Decision now:** Security package static gates PASS_OPERATOR_REPORTED. No explicit deploy authorization has been provided, so STOP at planning. P231.67 scoped IAM approval did not include deploy, invoker grant or cleanup execution.

P231_PACKAGE_GATE=PASS_OPERATOR_REPORTED
P231_OPERATOR_ENVIRONMENT=PASS_OPERATOR_REPORTED
P231_EFFECTIVE_DEPLOY_IAM=NOT_VERIFIED
P231_OPERATOR_ACT_AS=NOT_VERIFIED
P231_PRIVATE_INVOKER_PRINCIPAL=NOT_SELECTED
P231_STAGING_DEPLOY_APPROVAL=NOT_GIVEN
P231_ISOLATED_DEPLOY=NOT_PERFORMED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_PRODUCTION_DEPLOY=NOT_PERFORMED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
