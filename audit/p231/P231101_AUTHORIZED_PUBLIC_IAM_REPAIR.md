# P231.101 — Authorization to repair unexpected public invoker on isolated staging service

Date: 2026-11-26.
User explicitly approved removal of exactly the **unconditional** `allUsers` member of `roles/run.invoker` from Cloud Run Service `p231appcheckisolatedprobe` in project `packtook-staging`, region `asia-southeast1`, and subsequent read-only private IAM audit. User explicitly prohibits modifying IAM on any other service, redeployment, cleanup, changes to production or public signup.

Ground truth reported by operator:
- New Gen2 function `p231AppCheckIsolatedProbe` successfully created in staging.
- Runtime SA matches `p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com`.
- New service policy contains exactly one unconditional `roles/run.invoker` / `allUsers` direct grant (P231.99).
- App Check runtime not tested; E2E blocked until IAM verification.

Authorized procedure via script `audit/p231/isolated-test/p231100-remove-unintended-public-invoker-guarded.sh`:
1. Pull reviewed branch and `bash -n` check script.
2. `bash ... inspect` (read-only), expect target count 1 and unexpected public count 0. If different, STOP.
3. On success alone, run `P231100_IAM_REPAIR_CONFIRM=APPROVE_P231100_REMOVE_ALLUSERS_RUN_INVOKER_FROM_NEW_SERVICE_ONLY bash ... apply`. This executes narrowly scoped `gcloud run services remove-iam-policy-binding p231appcheckisolatedprobe --project=packtook-staging --region=asia-southeast1 --role=roles/run.invoker --member=allUsers --condition=None --quiet` and reads service policy again.
4. `bash audit/p231/isolated-test/p23194-postdeploy-private-readonly.sh` and report sanitized statuses; do not Invoke even if it reports direct-policy PASS until inherited access and invoker checks have been reviewed.
5. Never run any broader IAM mutation, deploy, cleanup or deletion, or change old functions.

The script is operator-side; creating this GitHub file **does not apply IAM changes**. If policy mutation fails or desired public member remains, stop and report.

P231_IAM_REPAIR_APPROVAL=YES_EXACT_SERVICE_BINDING_ONLY
P231_IAM_REPAIR_EXECUTION=AWAITING_OPERATOR
P231_SERVICE_PRIVATE_POST_REPAIR=NOT_VERIFIED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_E2E=BLOCKED
P231_DEPLOY=NO_NEW_DEPLOY_ALLOWED
P231_CLEANUP=NOT_AUTHORIZED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
