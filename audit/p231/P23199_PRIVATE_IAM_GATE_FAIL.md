# P231.99 — New isolated staging deployment succeeded but private IAM check FAIL

Operator reported 2026-11-26:
- Firebase CLI deployed **only** codebase `p231-isolated` Function `p231AppCheckIsolatedProbe` in `packtook-staging/asia-southeast1`; `P23198_DEPLOY_EXIT_CODE=0`.
- `P231_NEW_SERVICE=PRESENT`; `P231_RUNTIME_SERVICE_ACCOUNT=MATCH`.
- `P231_IAM_DISABLED_ANNOTATION=NOT_SET` and `P231_IAM_DISABLED_FIELD=NOT_SET`.
- `P231_SERVICE_DIRECT_PUBLIC_IAM_BINDINGS=1`; `P231_PRIVATE_IAM=FAIL_PUBLIC_BINDING`; `P23198_PRIVATE_AUDIT_EXIT_CODE=2`.
- `P231_INVOKER_GRANT=NOT_PERFORMED`.
- `P231_RUNTIME_APPCHECK=NOT_VERIFIED`; `P231_RELEASE=NO_GO`.

## Security interpretation
The Firebase Function was successfully created on staging and the new backing service has at least one direct public IAM binding. Public HTTP invocation may be possible; **do not assume the function is private**, irrespective of source `invoker:'private'` or the `enforceAppCheck:true` source setting. No App Check runtime evidence has been collected. Production and other staging functions must remain untouched.

**Fail closed:** no runtime invocation, no service-wide or project IAM grants, no unrelated IAM changes, no repeated deploy, no cleanup/deletion. Avoid pasting all IAM members, tokens or service URLs with sensitive query values.

The immediate read-only `p23199-public-binding-readonly.sh` displays only public member and role information for the **new** Cloud Run Service. It validates the dedicated runtime service account and current project.

After reviewing the exact public role/principal, propose a narrowly scoped fix on the **new** Cloud Run service only. If applicable, removal of an unintended public binding must be an explicit bounded IAM action and must be followed by fresh read-only verification; never modify existing functions or project-wide bindings. A service-level IAM pass still does not prove all inherited/public access is absent or that App Check actually rejects missing/invalid tokens.

Cleanup execution still requires separate user approval.

P231_DEPLOY=SUCCESS_STAGING_ONE_NEW_FUNCTION
P231_PRIVATE_IAM=FAIL_PUBLIC_BINDING
P231_SERVICE_DIRECT_PUBLIC_IAM_BINDINGS=1
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_E2E=BLOCKED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
