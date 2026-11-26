# P231.92 — Private Invoker Principal and Cleanup Plan (READ ONLY)

Date: 2026-11-26. User explicitly requested read-only review **without** IAM changes or deployment.

## Existing evidence
- P231.89: eight preliminary operator permissions including `iam.serviceAccounts.actAs` allowed, operator reported.
- P231.90: Firebase CLI v15.34.2; isolated source, export count and `--only` support checked; codebase/function selector remains subject to CLI-version-specific review.
- P231.86: the local preview is scoped to `p231-isolated` and one new function, and is not deployed.
- Existing staging services have public invoker bindings; those services must not be modified.

## Principal choice
The currently active Cloud Shell account is a **candidate only**. The review script checks there is one active identity and reports only an identity classification, not its name/email. It tests the project-scoped permission subset `run.services.get`, `run.services.getIamPolicy`, `run.services.setIamPolicy`, `run.routes.invoke`, `cloudfunctions.functions.get`, `cloudfunctions.functions.delete`, `run.services.delete`. A project-level `:testIamPermissions` is **not** proof of permission at a future service-level IAM policy. The test may report denied/unknown where conditions or future resources matter.

**Not approved:** choosing this principal as final invoker, service-level `roles/run.invoker` binding or any public invoker grant. Separate identity review and scoped consent are required. No identity token values in logs or chat. Firebase Auth and Cloud Run IAM authentication are separate contexts.

## Proposed Cleanup Plan (NOT APPROVED)
- Scope: only newly created `p231AppCheckIsolatedProbe` in `asia-southeast1`, `packtook-staging`, and only the service-specific invoker grant made for this test.
- Timebox: propose same-day (or explicit fixed expiry) test and cleanup, exact deadline and responsible operator to be confirmed *before* deployment.
- Before creation: record git commit, source file checksums, Firebase CLI version, expected codebase, project, function name and runtime SA. Review estimated cost and monitoring.
- After creation and **before invoking**: verify correct active revision, runtime identity and private Cloud Run invoker IAM. If any public `allUsers` / `allAuthenticatedUsers` grant or invoker IAM disabled, stop and do not invoke.
- E2E: use one synthetic verified staging Auth user and legitimate App Check token; same endpoint and Auth context for VALID/MISSING/MALFORMED; do not expose tokens. Distinguish IAM errors from Firebase App Check errors.
- After tests: separately authorize deletion of *only* the new function and any service-level test grant. Confirm no existing staging service, production asset, Hosting, Firestore or real customer data changes. A failed partial deletion is an incident to review, not a reason for blanket cleanup.
- Keep dedicated runtime Service Account and project-level verifier role until separate removal authorization.
- Do **not** use `--force`, broad `firebase deploy --only functions`, broad function delete, or any Production commands.

## Gate status
P231_PRIVATE_INVOKER_IDENTITY=NOT_SELECTED
P231_OPERATOR_INVOKER_PERMISSIONS=AWAITING_READ_ONLY_RESULT
P231_SERVICE_LEVEL_IAM=NOT_VERIFIED
P231_CLEANUP_PLAN=DOCUMENTED_NOT_APPROVED
P231_DEPLOY=NOT_PERFORMED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
