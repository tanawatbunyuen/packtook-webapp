# P207 — Source Provenance Verification Readiness

**Review-only, offline. NO_GO_G02 / NO_GO_RELEASE / NO_GO_DEPLOY / KEEP_PUBLIC_SIGNUP_CLOSED.**

## Historical evidence currently available
- GCloud operator's function metadata pinned Gen2 `packtook-staging`, `usageStatus`, Node.js 22, build `8dc6958c-b6dc-4188-a675-2740b18f7098`, source `gs://gcf-v2-sources-689946391888-asia-southeast1/usageStatus/function-source.zip#1794070024475037`, revision `usagestatus-00021-nob`.
- Cloud Build reported `SUCCESS`, but submitted `results.images` contained **no output digest**.
- Cloud Run revision reported `Ready=True` and three matching image digest references `sha256:524bd687470632f6ad654bfe14d1d58bdfcd1f6bd897d672fcdcff4977de20fa`.
- Artifact Registry has 7-day `DELETE` policy for `ANY` tag; package visible, version not visible, deletion logs empty. The exact cause of absent version is **not proven**.
- P188 isolated candidate SHA256 `c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b` was not attested as deployed. **Nov 7 revision predates P188 candidate** and must not be presumed equivalent.

## Provenance proof sequence for an independently authorized operator
1. Obtain authenticated original source archive metadata + bytes from the pinned GCS **generation**. If already removed, record an evidence gap rather than reconstruct it by assumption. Keep original source in a protected environment, not CI/PR.
2. Compare the actual source tree's relevant files and six security edits against the exact P188 candidate. **ZIP hash alone does not equal a source-tree or reviewed-candidate SHA**; packaging can change bytes.
3. Independently obtain original Cloud Build `results.images` or trusted build provenance, confirm build-id, source generation, output repository and `sha256` digest. Do not infer Build output digest from Cloud Run's image digest.
4. Independently obtain Cloud Run pinned revision and container digests, compare exactly to trusted Build image digest, check target service and runtime identity.
5. If registry image no longer exists, document deletion/retention limitation. An old Ready revision is not proof of source equivalence.
6. Security reviewer checks original evidence through protected independently authenticated channel; an operator's assertion, digest metadata, or CI fixture is not independent review.
7. No deployment, migration, IAM edit, artifact retention edit or production read is authorized by P207.

## Code
`audit/p207/verify.js` receives a sanitized metadata object, reports missing or contradictory provenance, and always returns G02 **NO_GO** even if all claims appear internally consistent. `audit/p207/fixtures.js` uses synthetic negative/positive scenarios. CI is read-only with no cloud credentials.

## Release blockers
Original source ZIP bytes not independently authenticated; P188-to-deployment byte equality unknown; Cloud Build output digest missing; image retention makes later direct inspection uncertain; real staging App Check and independent Owner / security review not performed. 5/5 independent external requirements outstanding; 8/8 release gates blocked.
