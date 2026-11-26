# P231.89 — Scoped staging-only predeployment preparation

Recorded 2026-11-26. User explicitly authorized preparing the deployment of **only** `p231AppCheckIsolatedProbe` in `packtook-staging`, conditioned on Effective IAM, `actAs`, Private Invoker and Cleanup Gate. The user expressly prohibited changes to Production, existing Functions or Public Signup. **This is not permission to bypass any failed condition.** No deploy executed in this phase.

## Read-only authorization checks

Run `python3 audit/p231/isolated-test/p23189-effective-iam-readonly.py` in Cloud Shell with active project `packtook-staging`.

- Uses existing Google Cloud user credentials in memory and official `:testIamPermissions` operations. Never prints access token, account email, responses containing user identifiers, or policy member lists.
- Project permission subset: `cloudfunctions.functions.create/get/list/update`, `run.services.create/get`, `cloudbuild.builds.create`.
- Dedicated runtime identity: `iam.serviceAccounts.actAs`.
- Interpret `ALLOWED` as explicit tested permission only. `NOT_GRANTED_OR_DENIED` and `UNAVAILABLE` both block advancement. These checks do **not** prove Firebase CLI deployment will succeed; APIs, service agents, Artifact Registry, build permissions and resource policy requirements can differ.

## Invoker architecture and deployment boundary
- Candidate has `invoker:'private'`. There must not be any direct `allUsers` / `allAuthenticatedUsers` invoker on the **new service**, nor disabled invoker IAM check or inherited public grants. Confirm after creating *only* the isolated service and before attempting invocation.
- Invocation needs a separately approved, explicitly named operator principal with service-level `roles/run.invoker` **only on the new service**. No project-wide invoker binding.
- Call Firebase Auth with `Authorization`, Firebase App Check with `X-Firebase-AppCheck`, and Cloud Run IAM with `X-Serverless-Authorization` via operator-side client only; no token value in chat, logs, commit or shell transcript.
- Exact Firebase CLI codebase-filter command must be independently checked on the installed Firebase CLI version and the generated temporary config before any actual deployment; never use bulk `firebase deploy --only functions`.

## Cleanup gate
- Cleanup target exactly `p231AppCheckIsolatedProbe` in `asia-southeast1`, project `packtook-staging`; verify the new function's source/revision before any delete.
- Decide and record test owner, same-day or fixed expiry, spend/log limits, and post-test deletion procedure before deployment.
- Clean up only newly created function and its service-level invoker grant with separately approved commands. Existing `usagestatus`, `recordingstatus`, `accountrole`, Hosting, billing/payments, databases, and Production are explicitly out of scope.
- Dedicated runtime SA and project-level verifier role must remain unless explicitly approved for later removal.

## Required decision
Approval to prepare does not remove these prerequisites: IAM, actAs, Invoker, Cleanup and exact deploy scope must be separately confirmed. Any failed / inaccessible permission check is a stop, not an invitation to elevate privileges.

P231_PREPARE_APPROVAL=APPROVED_STAGING_ONLY_WITH_CONDITIONS
P231_EFFECTIVE_IAM=NOT_YET_TESTED
P231_OPERATOR_ACT_AS=NOT_YET_TESTED
P231_INVOKER_PRINCIPAL=NOT_SELECTED
P231_PRIVATE_INVOKER_GATE=NOT_PASSED
P231_CLEANUP_GATE=NOT_PASSED
P231_DEPLOY=NOT_PERFORMED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
