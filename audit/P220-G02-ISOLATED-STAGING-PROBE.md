# P220 — Isolated G02 staging probe, NOT yet deployed

User authorized isolated Staging test deployment, not production promotion or public signup. This PR prepares a narrow new function only. The tools connected to ChatGPT in this session can write GitHub but cannot execute authenticated Google Cloud CLI. **Actual Staging deployment has not occurred.**

## Security design

The exact P188 candidate is rebuilt and SHA-pinned before any operator deploy action. Because P188 is the complete backend, deploying it directly would create unrelated payment, owner, signup and other callable exports. P220 instead creates a **separate, reduced-scope security probe** with only one callable entry point `g02AuthzProbe`:
- Firebase Auth email must be verified and UID begins `g02test_` followed by 10–60 safe characters
- Reads only `accounts/<caller UID>` and requires explicit ownerUid equal to token UID; no auto-backfill, no client owner parameters
- Returns only Boolean authorization, role and synthetic marker; no customer fields
- `enforceAppCheck:true`, Cloud Run invoker private, 1 instance, 15s timeout
- No Payment/Omise, no signup, no Firestore writes, no secret reads, no IAM modifications in code
- A dedicated pre-existing `g02-probe-runtime@packtook-staging.iam.gserviceaccount.com` service account is required to deploy. It must have only the permissions independently approved for read-only synthetic test records. **Do not auto-create/grant broad roles.**

This probe is NOT equivalent to executing full P188 in the deployed Staging environment, and does not close G02 or certify App Check positive flows. Full G02 remains NO_GO until source-to-deployed-revision verification and independent reviewer signoff.

## Cloud Shell (separately authenticated operator session)

From a clean checkout of branch `review/p220-g02-isolated-staging-probe`, with the dedicated service account independently created/reviewed and a working least-privilege configuration, run:

```bash
gcloud config set project packtook-staging
export GCLOUD_PROJECT=demo-packtook-p184
export GOOGLE_CLOUD_PROJECT=demo-packtook-p184
export G02_PROBE_SERVICE_ACCOUNT=g02-probe-runtime@packtook-staging.iam.gserviceaccount.com
export G02_STAGING_DEPLOY_EXPLICIT=YES
bash audit/p220/deploy-staging.sh --deploy
```

**Read carefully:** demo-only environment variables are required solely by the P188 local candidate generation; the deploy script explicitly passes `--project=packtook-staging` and checks the CLI active project. Do not alter IAM or production services to make the script pass. If dedicated SA does not exist, deployment must remain BLOCKED pending a separate IAM setup review. The script does not call live G02 positive/negative tests or modify customer accounts. Use private invoking identity and actual App Check token for valid positive runtime test, plus negative authorization tests, before any claim of G02 runtime PASS.

**No data migration, no replacement of `usageStatus`, no existing revision changes, no production access or release gate promotion.**
