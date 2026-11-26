# P231.98 — Guarded source and inventory inspection PASS; scoped retry eligible

Date 2026-11-26. Cloud Shell operator supplied:
- P231_CHECK=GUARDED_STAGING_ISOLATED_DEPLOY
- P231_MODE=inspect
- P231_PROJECT=packtook-staging
- P231_FUNCTION=p231AppCheckIsolatedProbe
- P231_CODEBASE=p231-isolated
- P231_EXACT_SOURCE_SCOPE=PASS
- P231_PREVIEW_FIREBASE_FUNCTIONS_RESOLUTION=PASS
- P231_NEW_FUNCTION_COLLISION=NO
- P231_NEW_SERVICE_COLLISION=NO
- P231_GATE=INSPECTION_PASS_NOT_DEPLOYED
- P23197_INSPECT_EXIT_CODE=0
- P231_DEPLOY=NOT_PERFORMED
- P231_RUNTIME_APPCHECK=NOT_VERIFIED
- P231_RELEASE=NO_GO

The P231.96 local npm ci resolved the Firebase Functions package missing on the P231.94 first deployment attempt. The guarded source and inventory preflight is now successful; this does not guarantee CLI deployment success or runtime App Check verification.

The user approved P231.94 deploy of this **one new staging function only**, scoped private active operator invoker on the **new service only**, same-day testing, with a separate approval required for cleanup execution. The approved-day lock in P231.94 guards against deploying on a later day. Do not bypass the date lock or alter original source config to make deployment succeed.

## Operator actions in order
1. Run P231.94 deploy mode for the same isolated preview, with one-time confirmation, only if the approved test date is 2026-11-26 Asia/Bangkok and active Cloud project is packtook-staging.
2. If deploy fails or partially creates resources: stop, inspect inventory, never automatically retry or delete.
3. If deploy succeeds: run P231.94 postdeploy read-only private IAM audit. No invocations before verifying service identity, runtime identity, policy, invoker IAM enabled, direct and inherited access limitations. If any public policy, IAM disabled or unknown, stop.
4. Only after private IAM review, run the service-specific, active-operator invoker grant script in inspect then apply modes. No project-wide roles or public principals.
5. Only after identity, IAM and verified App Check tokens are available, test valid/missing/invalid App Check cases in isolation and capture sanitized evidence.
6. Cleanup only under separate user approval. Production and existing functions untouched; Public Signup remains closed.

P231_STAGING_DEPLOY_READY=YES_PENDING_OPERATOR_EXECUTION
P231_STAGING_DEPLOY_EXECUTED=NO
P231_PRIVATE_IAM_POSTDEPLOY=NOT_VERIFIED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_CLEANUP_EXECUTION=NOT_AUTHORIZED
P231_RELEASE=NO_GO
