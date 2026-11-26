# P231.87 — Isolated scope PASS; deployer permission review pending

Date: 2026-11-26. Operator-supplied Cloud Shell result:
- P231_ISOLATED_SCOPE=PASS
- P231_FUNCTION_EXPORT=PASS
- P231_PRIVATE_INVOKER_SOURCE=PASS
- P231_RUNTIME_SERVICE_ACCOUNT_SOURCE=PASS
- P231_CLEANUP_TARGET=p231AppCheckIsolatedProbe_ONLY
- P231_CLEANUP_ACTION=DOCUMENTED_NOT_EXECUTED
- P231_DEPLOYMENT_APPROVAL=NOT_GIVEN
- P231_IAM_WRITES=0; P231_FIREBASE_WRITES=0
- P231_RUNTIME_APPCHECK=NOT_VERIFIED; P231_RELEASE=NO_GO
- P231_SCOPE_EXIT_CODE=0

A passing package-preview scope check does not establish live Cloud Run invoker restrictions or effective App Check enforcement.

Next gate: read-only check of operator permissions relevant to using the dedicated service account and deploying the new staging function, without modifying IAM or granting rights. Permission tests can be affected by Deny policies and conditional bindings; direct role presence alone is not effective authorization. Never paste access tokens, private principal identities, or unrelated IAM members into chat.

Deployment only after separate scoped approval, review of Firebase CLI codebase selector, private test principal, explicit rollback/cleanup, and source revision pin. No broad functions deploy; do not modify existing staging functions. Production and public signup remain unchanged.

P231_SCOPE_PREVIEW=PASS_OPERATOR_REPORTED
P231_DEPLOYER_PERMISSION=NOT_VERIFIED
P231_INVOKER_PRINCIPAL=NOT_SELECTED
P231_DEPLOY_APPROVAL=NOT_GIVEN
P231_ISOLATED_DEPLOY=NOT_PERFORMED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
