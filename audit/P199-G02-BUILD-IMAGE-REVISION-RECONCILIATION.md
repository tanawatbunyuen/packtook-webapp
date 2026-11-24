# P199 — Staging Cloud Build Result & Deployed Revision Digest Reconciliation

## Evidence supplied by operator, November 24 2026
Cloud Build substitutions reference precisely `gs://gcf-v2-sources-689946391888-asia-southeast1/usageStatus/function-source.zip#1794070024475037`, the Gen2 Node22 function target `usageStatus`, and a managed Google builder runtime. Build timing in supplied excerpt: November 7, 2026 16:47:06–16:47:59 UTC. This ties a reported build input to a source object generation but does **not** show `status: SUCCESS` or `results.images[].digest`.

**Important:** `_GOOGLE_BUILD_ENV: "prod"` is Google's build environment substitution; it does *not* mean a deployment to the PACKTOOK production Firebase project. The resource references remain `packtook-staging`.

## Missing verification
- Real `status` field of the exact Cloud Build.
- Exact pushed artifact `results.images` name and SHA256 digest, if available; inspect other build result fields if image metadata schema differs.
- Read-only Cloud Run Revision metadata for `usagestatus-00021-nob` including deployed image digest. An exact image digest equality check between Build and Revision is required.
- Independent source archive content verification and release-candidate six-diff source review; container digest equality alone does not prove P188 code.
- Real authorized staging App Check and independently reviewed Owner provenance.

## Offline preflight
`audit/p199/verify.js` validates the exact build source substitution and, when separately supplied, Build image SHA256 and Cloud Run Revision's image digest. It fail-closes on mismatches, missing image data, wrong region/project, and stale revision. All metadata, even matching, remains **NO_GO** absent independent attestation.

No Cloud SDK is invoked by this P199 test workflow, and no source ZIP is downloaded. Do not paste credentials or account data. Protected Cloud Operator can collect the missing *read-only* build and revision metadata in their own approved session; the resulting sanitized digest/metadata should be reviewed independently.

## Example read-only operator commands (only after authorization)
```bash
gcloud builds describe 8dc6958c-b6dc-4188-a675-2740b18f7098 --project=packtook-staging --region=asia-southeast1 --format='json(status,results.images,images)'
gcloud run revisions describe usagestatus-00021-nob --service=usagestatus --project=packtook-staging --region=asia-southeast1 --format='json(metadata.name,spec.containers,status.imageDigest)'
```
Never use these commands in GitHub CI; validate exact resource paths before their use. Do not merge, deploy or open signup.
