# P231.100 — Unintended public invoker on new isolated staging function

Operator reported 2026-11-26:
`P231_PUBLIC_BINDING_COUNT=1`
`P231_PUBLIC_BINDING_ROLE=roles/run.invoker PRINCIPAL=allUsers CONDITIONAL=false`
`P23199_AUDIT_EXIT_CODE=0`
`P231_RUNTIME_SA=MATCH`
`P231_NEW_SERVICE=PRESENT`
`P231_IAM_DISABLED=NO_OR_NOT_SET`.

## Interpretation
A direct unconditional `roles/run.invoker` grant to `allUsers` makes the **new test Cloud Run Service** publicly invocable at the IAM layer. The source's `invoker:'private'` did not result in a private service-level policy. App Check enforcement is NOT runtime verified. Stop E2E and consider this an urgent limited-scope remediation. Existing functions and production must remain untouched.

## Narrow repair proposal — NOT YET AUTHORIZED
- New Service `p231appcheckisolatedprobe` in `packtook-staging/asia-southeast1` only.
- Remove **only** the unconditional `allUsers` binding for `roles/run.invoker`.
- Keep all other members, roles, policies, project IAM, existing services, runtime SA, service agents and public-signup state unchanged.
- Require a new explicit consent for the IAM removal; user P231.94 did approve private invoker on new service, but the user P231.99 outcome was not yet a bounded removal authorization.
- Prior to removal, confirm cloud function exists with expected dedicated runtime SA, function points to expected service if that field is populated, target IAM binding count equals 1, and no unexpected direct public members.
- Following removal, check direct service policy and service-level IAM-disabled flag. Then perform separate inherited IAM examination and, when safe, service-only private operator grant.
- **Cleanup/delete is NOT authorized**; no automatic function or grant deletion. Production NO-GO.

Script `p231100-remove-unintended-public-invoker-guarded.sh` defaults to read-only inspect. Its apply mode is guarded by exact environment authorization `P231100_IAM_REPAIR_CONFIRM` and should only be used AFTER approval. No invocation at this step.

P231_DEPLOY=SUCCESS_ISOLATED_STAGING
P231_PRIVATE_IAM=FAIL_DIRECT_ALLUSERS_BINDING
P231_PUBLIC_IAM_REPAIR=AWAITING_EXPLICIT_APPROVAL
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_E2E=BLOCKED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
