# P200 — Actual user-supplied Cloud Run Revision evidence
The operator supplied a `serving.knative.dev/v1` Revision for `usagestatus-00021-nob` in project number 689946391888, corresponding to `packtook-staging`. The revision indicates readiness and the fixed Build ID `8dc6958c-b6dc-4188-a675-2740b18f7098`, target `usageStatus`, source ZIP generation `1794070024475037`, and matching image digest across `spec.containers[0].image`, `status.imageDigest`, and `status.containerStatuses[worker].imageDigest`.

The deployed revision image digest reported is:
`sha256:524bd687470632f6ad654bfe14d1d58bdfcd1f6bd897d672fcdcff4977de20fa`.

**Interpretation:** A stable deployed *image* has been identified in user-provided metadata. The Cloud Build excerpt previously supplied did **not** show `status: SUCCESS` or `results.images[].digest`, so equality between the original Cloud Build output digest and deployed revision is **not verified**. More importantly, P188 Candidate's source changes were developed after this November 7 revision and have not been shown to exist in this deployed image.

P199 compared an unrealistic fully qualified revision name and did not independently check status/spec/container digest consistency. P200 reconciles the actual Google Cloud Run v1 revision structure with bounded, deterministic tests. No Cloud APIs are called by the CI.

## Next read-only operator verification
Run only with independent Staging authorization:
```bash
gcloud builds describe 8dc6958c-b6dc-4188-a675-2740b18f7098 --project=packtook-staging --region=asia-southeast1 --format='json(status,results.images)'
```
If `results.images` is absent, an independent reviewer can inspect Cloud Build detailed results or Artifact Registry provenance, recording only sanitized fields. Do not submit credentials or source archives. No deployment, production writes or public signup.

G02 NO_GO / RELEASE NO_GO until full source and security evidence and independent review.
