# P231.103 — Inherited public IAM check PASS; active operator invoker next

Operator-reported Cloud Shell output on 2026-11-26:
- P231_PROJECT_IAM=READABLE
- P231_PROJECT_PUBLIC_BINDINGS=0
- P231_ANCESTRY=READABLE
- P231_INHERITED_PUBLIC_IAM=NO_EXPLICIT_PUBLIC_PRINCIPALS
- P231102_INHERITED_IAM_EXIT_CODE=0
- P231_OPERATOR_SERVICE_INVOKER=NOT_GRANTED_BY_THIS_SCRIPT
- P231_IAM_WRITES=0
- P231_E2E=NOT_PERFORMED
- P231_RUNTIME_APPCHECK=NOT_VERIFIED

Earlier P231.101 post-remediation check reports P231_SERVICE_DIRECT_PUBLIC_IAM_BINDINGS=0, FUNCTION_STATE=ACTIVE and matching runtime SA.

The project and inspected ancestor IAM bindings returned no explicit allUsers/allAuthenticatedUsers members. This is a structural audit, not a complete proof of effective private endpoint access. Cloud Run IAM-enabled flag, service-level policy, inherited privileges, and real request denial are separate checks.

The user's P231.94 authorization covers a `roles/run.invoker` binding to the **active operator user** on the **new test service only**, not project IAM. The approved authorization is still restricted to a staging same-day test and prohibits old functions/Production/signup changes. Cleanup remains independently approval-gated.

Security improvement: P231.94 active operator grant script now fails closed on unsupported mode and verifies zero public members after granting.

## Safe operation order
1. Fetch current branch and run shell syntax check.
2. `bash audit/p231/isolated-test/p23194-grant-active-operator-invoker.sh inspect` to ensure active operator is a regular Google user, new function has expected dedicated runtime SA, Cloud Run IAM isn't disabled, and zero public direct policy members.
3. If and only if inspect succeeds and same-day approval remains valid, use `P231_INVOKER_CONFIRM=APPROVE_P23194_ACTIVE_OPERATOR_SERVICE_INVOKER_ONLY bash ... apply`, using the existing P231.94 user authorization; the script changes **only** the new Cloud Run service IAM binding.
4. Recheck direct policy with `p23194-postdeploy-private-readonly.sh` and public IAM inventory. Stop on any public member or unknown IAM status.
5. **No E2E in this phase.** Future invocation requires verified Cloud Run IAM identity token, verified staging Firebase Auth and legitimate App Check token, with no logging of raw tokens.
6. Cleanup is not authorized. No deploy, root function changes, production changes or public signup changes.

P231_INHERITED_PUBLIC_IAM=PASS_OPERATOR_REPORTED
P231_PRIVATE_OPERATOR_INVOKER=AWAITING_SCOPED_GRANT
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
