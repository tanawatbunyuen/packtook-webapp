# P231.90 — Operator testIamPermissions PASS; invocation and cleanup gates remain

Date: 2026-11-26. Recorded from the operator's Cloud Shell outputs, not an independently executed GCP call.

The active staging Cloud Shell operator received ALLOWED for eight tested permissions:
- cloudfunctions.functions.create, get, list, update
- run.services.create, get
- cloudbuild.builds.create
- iam.serviceAccounts.actAs on p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com

`P231_EFFECTIVE_DEPLOY_CAPABILITY=PARTIAL_REQUIRED_CHECKS_PASS`,
`P231_OPERATOR_ACT_AS=PASS_TEST_IAM_PERMISSIONS`,
`P231_IAM_GATE_EXIT_CODE=0`.

This confirms only the probed permissions **as evaluated**. It is not full Firebase CLI deployment authorization, does not establish permissions for creating service-level Invoker IAM binding, and does not establish effective private invocation. Do not add roles to force a deploy.

## Remaining gates
1. Confirm exact firebase CLI version and capability; confirm isolated source directory contains one codebase and one function export, independently of SaaS root. Never deploy `functions` generally or use `--force`.
2. Select an explicit **invoking operator principal** for the new Cloud Run service. Do not infer invoker rights from the active deployer session and do not expose bearer credentials; service-specific grant requires its own authorization.
3. Cleanup timebox (proposal: same-day test and teardown), audit logging and budget cap; deletion target only new `p231AppCheckIsolatedProbe` in `asia-southeast1`, packtook-staging. Never touch existing functions, Firestore, Hosting or production.
4. Post-create verify `invoker:'private'` became an effective policy: reject public principals at service level and IAM-disabled invoker check. If any issue, stop before E2E.
5. E2E requires legitimate valid App Check, missing and invalid App Check under same Firebase Auth and Google IAM caller; distinguish denial layer and pin revision.

P231_OPERATOR_TEST_PERMISSIONS=8_OF_8_ALLOWED
P231_OPERATOR_ACT_AS=PASS_OPERATOR_REPORTED
P231_PRIVATE_INVOKER=NOT_VERIFIED
P231_CLEANUP_GATE=NOT_APPROVED
P231_STAGING_DEPLOY=NOT_PERFORMED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
