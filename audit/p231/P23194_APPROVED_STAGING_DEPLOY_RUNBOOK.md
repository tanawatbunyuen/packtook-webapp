# P231.94 — Explicitly approved staging-only isolated function deploy runbook

Date: 2026-11-26. The user **explicitly authorized** deployment of only `p231AppCheckIsolatedProbe` to `packtook-staging`, using the current active operator as the private invoker **on the new service only**, testing within the same day, auditing private IAM before invocation and obtaining **separate approval for cleanup execution**. They expressly prohibited changes to Production, existing functions and Public Signup.

## Exact scope and holds
- Project: `packtook-staging`, region: `asia-southeast1`.
- Firebase codebase: `p231-isolated`, sole callable export: `p231AppCheckIsolatedProbe`, expected Cloud Run service: `p231appcheckisolatedprobe` (validate actual name after deploy; if unexpected, abort).
- Runtime SA: `p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com` (verifier binding separately operator-confirmed). Gen2 callable with `invoker:'private'`, `enforceAppCheck:true`, Node 22, maxInstances 1, concurrency 1, timeout 10s, fixed no-data response.
- Pinned verified lock SHA256: `630f6cb016ad21d99663055ba75c55f103b8a5eadf6ae5528bf658ffbc477c81`; Firebase CLI version 15.34.2.
- **No existing functions, Production, Hosting, Firestore, billing/payments, credits, public signup or project-wide invoker policy changes. No service account keys.**
- Scope control: a temporary `firebase.json` with exactly one codebase and three whitelisted function files; `firebase deploy --project packtook-staging --only functions:p231-isolated:p231AppCheckIsolatedProbe --non-interactive` without `--force`. Deployment can still create Cloud Build/Artifact Registry artifacts, logs and necessary GCP resources; these are test-related side effects and must be monitored.
- Command may fail/partially create a function; never blindly retry. Read-only inventory/revision audit after any failure.

## Operator sequence
1. Revalidate `P231.85` preview, local directory and current project; run `p23194-staging-deploy-guarded.sh PREVIEW inspect`. Fail closed on ambiguous state.
2. Only on successful inspection, re-review scope and use exact env confirmation `P231_DEPLOY_CONFIRM=APPROVE_P23194_NEW_STAGING_PROBE_ONLY` for `... deploy`. No production deployment authorization.
3. Immediately run `p23194-postdeploy-private-readonly.sh` and independently inspect current Cloud Run IAM. **DO NOT invoke** on any public binding, disabled Invoker IAM, wrong runtime identity, unexpected service name, unknown revision or unreadable policy. Project/folder inherited permissions remain a separate concern.
4. Only if private and correct, run `p23194-grant-active-operator-invoker.sh` in inspection mode, then `P231_INVOKER_CONFIRM=APPROVE_P23194_ACTIVE_OPERATOR_SERVICE_INVOKER_ONLY` with `apply`. This grants only `roles/run.invoker` for the active Google user on the *new* Cloud Run service; it refuses service accounts/federated identities as a safe default. No other IAM edits allowed. Record post-grant policy sanitized.
5. E2E three cases require a properly authorized staging Firebase Auth test user and valid App Check token: VALID, MISSING, MALFORMED. The approved deploy does not authorize exposing raw credentials. Runtime App Check remains unverified until all three actual HTTP cases are attributed.
6. **Same-day cleanup plan only, NOT executed**: user must separately approve exact deletion of the newly created Function and its own invoker grant after checking project, region, service and revision. No broad delete or generic `--force`. Retain dedicated runtime SA and project verifier grant pending another explicit approval. Operator is cleanup owner; exact deadline must be agreed before proceeding beyond deployment if testing cannot finish within same day.

## Status
P231_STAGING_DEPLOY_APPROVAL=SCOPED_APPROVED
P231_OPERATOR_INVOKER=ACTIVE_USER_APPROVED_NEW_SERVICE_ONLY
P231_CLEANUP_TIMEBOX=SAME_DAY_APPROVED_PLAN_ONLY
P231_CLEANUP_EXECUTION=REQUIRES_SEPARATE_APPROVAL
P231_DEPLOY_SCRIPT=CREATED_NOT_EXECUTED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
