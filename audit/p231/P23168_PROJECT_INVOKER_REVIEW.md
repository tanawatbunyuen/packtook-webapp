# P231.68 — Project-level Invoker check

Recorded 2026-11-26. Operator-supplied Cloud Shell output.

`P231_PROJECT_PUBLIC_INVOKER_BINDINGS=0`
`P231_NEW_FUNCTION_INVOKER=NOT_CONFIGURED`
`P231_IAM_WRITES=0`
`P231_FUNCTION_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`

Conclusion: no direct project-level `roles/run.invoker` bindings to `allUsers` or `allAuthenticatedUsers` in the policy returned by the operator's query. This alone does **not** establish that other services are private. Service-level invoker bindings and the `run.googleapis.com/invoker-iam-disabled` / API equivalent must also be considered, along with inherited permissions. No isolated P231 function exists yet.

Next: read-only metadata audit of the existing three staging callable services `usagestatus`, `recordingstatus`, `accountrole` without printing their IAM member identities or deployed source. No IAM modifications authorized. Do not infer security of an undeployed P231 service from the status of existing callable services.
