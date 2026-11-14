# PACKTOOK Omise TEST — V2 HTTP status staging image rollout

Owner's last real Staging Job execution failed with `PROVIDER_HTTP_NOT_SUCCESS` while the original image did not log HTTP status. PR #45 adds safe numeric status logging; this PR supplies a guarded handoff to deploy **only that reviewed image** to **Staging Job**, without executing it.

## Exact sequence for Owner-controlled Google Cloud Shell
1. Open the current `~/packtook-webapp` checkout, fetch review branch and use an **isolated Git worktree**, leaving original local changes untouched. Pin exactly to the reviewed current PR SHA (not a mutable branch name).
2. Verify Staging gcloud active project, and use existing publishing script for a new reviewed SHA. Its `--publish` requires independent opt-in and a clean tree. Example after checkout, replacing placeholder:
```bash
export RR_STAGING_PROJECT_ID=packtook-staging
export RR_REVIEWED_COMMIT_SHA=<reviewed-40-character-SHA>
python3 production/scripts/rr-publish-omise-staging-image.py
export RR_CONFIRM_STAGING_PUBLISH=PUBLISH_TO_PACKTOOK_STAGING_ONLY
python3 production/scripts/rr-publish-omise-staging-image.py --publish
```
3. Inspect `gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/packtook-staging/packtook-staging-probes/packtook-omise-test-probe --include-tags --project=packtook-staging`, record the new SHA-256 digest. Never reuse old digest `813990148140e6709bb93dc86e303627b393462cb1f2031efcb07215f80ab00b`.
4. **Preview only** the guarded Staging Job image change:
```bash
export RR_STAGING_PROJECT_ID=packtook-staging
python3 production/scripts/rr-stage-omise-diagnostic-image.py --new-digest=sha256:<NEW_64_CHARACTER_DIGEST>
```
This verifies existing deployed Staging Job, service account, one task, zero retries, expected mounted secret, allowed environment, old digest and new Artifact Registry digest. It prints `STAGING_JOB_UPDATE: DRY_RUN_ONLY`.
5. If preview PASS and Owner explicitly approves **Staging Job image update only**:
```bash
export RR_CONFIRM_JOB_IMAGE_UPDATE=UPDATE_PACKTOOK_STAGING_JOB_IMAGE_ONLY
python3 production/scripts/rr-stage-omise-diagnostic-image.py --new-digest=sha256:<NEW_64_CHARACTER_DIGEST> --apply
```
This executes `gcloud run jobs update --image=<new-immutable-digest>`, preserving existing env and secret mounts. It **DOES NOT RUN JOB**.
6. Independently inspect `gcloud run jobs describe packtook-omise-test-probe --project=packtook-staging --region=asia-southeast1 --format=yaml`. Only after verifying current Job image, exact test charge and TEST key ownership should you separately approve exactly one execution.
7. Capture only sanitized `FAILURE_CATEGORY` and `PROVIDER_HTTP_STATUS`. If HTTP 401: inspect mismatched/invalid TEST key in Secret Manager privately; if 404: verify charge belongs to same Omise Test account. **No repeated blind executions, no secret value in logs/chat**.

## Safety boundaries
- GitHub PR CI tests roll-out guard **offline only**. It neither publishes an image nor updates/executes the Cloud Run Job.
- Never grant Production access, modify Live Omise keys, or open Public signup. No human authorization to release Production.
- The verified historical failure remains unresolved until a new real Staging run.

**NO_GO_RELEASE / PUBLIC CLOSED / NO PRODUCTION CHANGES.**
