# P197 — Gen2 Describe Reconciliation From Operator-Supplied Evidence

## Observed Staging metadata (supplied by the user; NOT a direct independently authenticated query)
- Function resource: `projects/packtook-staging/locations/asia-southeast1/functions/usageStatus`
- Gen 2, Node.js 22, ACTIVE, revision `usagestatus-00021-nob`.
- `url` equals the pinned Cloud Functions URL `https://asia-southeast1-packtook-staging.cloudfunctions.net/usageStatus`.
- `serviceConfig.uri` is the distinct underlying Cloud Run URI `https://usagestatus-x5r74jtjza-as.a.run.app`.
- The build references a GCF source ZIP in `gcf-v2-sources-689946391888-asia-southeast1` with a specific object generation. The resolved storage source and requested source identify the same object and generation.
- `serviceConfig.serviceAccountEmail` names `packtook-staging-runtime@packtook-staging.iam.gserviceaccount.com`. `buildConfig.serviceAccount` contains a **different** compute account identifier; this alone does NOT prove an IAM misconfiguration since build and runtime identities have separate purposes.

## Defect discovered and corrected
P196 incorrectly prioritized `serviceConfig.uri` (Cloud Run) over `url` (official callable), falsely classifying a valid Gen2 function endpoint as unpinned. The P197 branch corrects the helper to check **only** the actual callable URL against the approved fixed endpoint. It records Cloud Run URI as a distinct metadata observation without accepting that URI as an App Check probe destination.

The previous P196 fixture erroneously placed the callable URL inside `serviceConfig.uri`; that fixture is updated to match real Gen2 field shapes. P197 also adds a sanitized operator-evidence fixture with negative tests.

## Security conclusions / blockers
1. **The supplied describe response does not attest deployed P188 source.** A Cloud Build identifier, GCS object generation and Firebase Functions SHA1-style label do not prove byte-for-byte equality to the isolated release candidate SHA256 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b`. An independent reviewer must inspect the protected build/source provenance, revision and deploy diff. No automatic source import/download.
2. **App Check is not verified.** The P187 probe requires a separately approved real staging Firebase Auth ID token and valid App Check token from the legitimate flow. The mere presence of Function and public ingress does not demonstrate callable App Check enforcement or lack thereof. Do not call the Cloud Run URI without a separately reviewed endpoint pin.
3. `ingressSettings: ALLOW_ALL` means network ingress isn't restricted by that setting, but does not independently reveal whether Firebase Auth/App Check rejects unauthorized requests. Runtime IAM and Invoker policy must be reviewed separately.
4. Operator-supplied metadata is real evidence to assess, not cryptographically verified operator identity; it does **not** close G02.
5. The function update date `2026-11-07` is earlier than the P188 candidate patch. This is further reason **not** to assume P188 code is deployed. Dates are not cryptographic provenance.

**No production reads/writes, no staging deployment, no merge, no migration, no public signup. NO_GO_G02 and all G01–G08 gates remain NO_GO.**
