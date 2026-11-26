# P231.67 — Staging dedicated service identity IAM bootstrap completed

2026-11-26. Operator-supplied Cloud Shell results, not an independently queried cloud state.

Project: `packtook-staging`.
Runtime SA: `p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com`.
- Prior read-only recovery: `P231_SERVICE_ACCOUNT=EXISTS`, `P231_SA_DISABLED=false`, role binding NOT_FOUND.
- Subsequent operator IAM recovery: `P231_IAM_BINDING_OPERATION=SUCCESS`, `P231_DIRECT_VERIFIER_BINDING=PASS`.
- Granted role: `roles/firebaseappcheck.tokenVerifier`, direct unconditional project binding for dedicated SA.
- Approved operations covered only creation of this dedicated SA and grant of verifier role. Operator says Invoker was not changed by the recovery command, no function deployment.

Caveats: direct role binding observed by operator does not independently establish effective IAM under deny policies or App Check runtime behavior. Project IAM change is real staging change. No production writes authorized. Need separately review private Cloud Run invoker, invocation identity, minimum privileges and exact deployed source before staging isolated-function deployment; never treat existing P231.67 approval as deployment approval.

`P231_DEDICATED_SA=EXISTS_ENABLED_OPERATOR_REPORTED`
`P231_DIRECT_VERIFIER_BINDING=PASS_OPERATOR_REPORTED`
`P231_INVOKER=NOT_CHANGED_BY_RECOVERY_SCRIPT`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
