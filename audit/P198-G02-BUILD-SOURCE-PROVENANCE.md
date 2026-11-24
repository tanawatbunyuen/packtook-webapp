# P198 — Staging Build Source Provenance Verification (operator preparation)

**G02 NO_GO. Production NO_GO_RELEASE. No staging or production cloud query was performed in CI.**

## Anchors from user-supplied staging describe
- Firebase function: `projects/packtook-staging/locations/asia-southeast1/functions/usageStatus` (Gen2, ACTIVE)
- Revision: `usagestatus-00021-nob`
- Cloud Build: `projects/689946391888/locations/asia-southeast1/builds/8dc6958c-b6dc-4188-a675-2740b18f7098`
- GCS source: `gcf-v2-sources-689946391888-asia-southeast1/usageStatus/function-source.zip`, generation `1794070024475037`
- Candidate SHA256 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b` is a **locally generated review-only candidate**, not attested to be deployed.

## How to establish provenance
An independently approved Staging operator may execute read-only `gcloud builds describe` for this **one fixed build**, but only outside CI under the P196 authorization gate and a separate P198 acknowledgment. The operator must inspect the exact project/build ID, status, source-generation linkage, output image digest and revision correspondence. The `audit/p198/verify.js` offline reconciler compares an explicitly supplied Build JSON record against Function JSON metadata. It never returns a GO result, even if metadata fields are consistent.

**Important:** Cloud Build metadata does not itself prove that the source ZIP contains the six P188 security changes, that the generated container uses the same bytecode, or that the Cloud Run revision serves that image. To prove this, a reviewer must verify the protected source archive against a canonical source manifest, Cloud Build output image digest and the deployed revision's digest. Do not upload source archives, IAM credentials, user data, App Check tokens or full raw build records to GitHub or chat.

## Required independent review
Cloud Operator authorization and source-image attestation, real staging App Check positive/negative probe, legacy account inventories, owner provenance and human security signoff are still outstanding. No deploy, merge, migration, Owner import or public signup.
