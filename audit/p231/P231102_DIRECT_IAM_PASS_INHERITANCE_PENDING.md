# P231.102 — Direct Cloud Run private IAM PASS; inherited IAM pending

Operator reported on 2026-11-26:
- `P231_NEW_SERVICE=PRESENT`
- `P231_IAM_DISABLED_ANNOTATION=NOT_SET`
- `P231_IAM_DISABLED_FIELD=NOT_SET`
- `P231_RUNTIME_SERVICE_ACCOUNT=MATCH`
- `P231_SERVICE_DIRECT_PUBLIC_IAM_BINDINGS=0`
- `P231_FUNCTION_STATE=ACTIVE`
- `P231_FUNCTION_SERVICE_ACCOUNT=MATCH`
- `P231_FUNCTION_REVISION_PRESENT=YES`
- `P231_PRIVATE_IAM=DIRECT_POLICY_PASS_INHERITED_NOT_VERIFIED`
- `P231101_PRIVATE_AUDIT_EXIT_CODE=0`
- `P231_E2E_INVOCATION=NOT_PERFORMED`; App Check remains unverified.

Interpretation: the unintended direct `roles/run.invoker:allUsers` grant on the new staging service is no longer present in its direct IAM policy, and the new function is active with the expected runtime SA. **Do not** yet claim end-to-end private accessibility; inheritance is not reviewed and App Check rejects have not been demonstrated.

Next: read-only audit of project, folder, and organization direct public policy members via `p231102-inherited-public-iam-readonly.sh`. The audit deliberately fails closed for unreadable ancestry/policies and reports only public principal/role totals, not user emails or raw IAM policy JSON. This is a conservative structural check; no explicit public parent members is not equivalent to complete effective access proof. A possible future test with uncredentialed HTTP can corroborate denial, but no calls authorized in this phase.

Do not perform further IAM grants, API invocations, deployments, cleanup, or production changes as part of this audit. P231.94 authorized service-only active operator invoker conditional on safety gates, but actual service-level grant has not been executed.

P231_DIRECT_PRIVATE_IAM=PASS_OPERATOR_REPORTED
P231_INHERITED_IAM=AWAITING_READ_ONLY_REVIEW
P231_SERVICE_LEVEL_PRIVATE_OPERATOR_INVOKER=NOT_GRANTED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_CLEANUP_EXECUTION=NOT_AUTHORIZED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
