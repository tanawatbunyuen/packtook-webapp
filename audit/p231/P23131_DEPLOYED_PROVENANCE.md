# P231.31 — Operator-observed staging deployment provenance

Recorded: 2026-11-26. Environment: `packtook-staging`, `asia-southeast1`. Evidence is copied from operator-supplied read-only `gcloud functions describe --gen2` output; it has **not** been independently verified with production credentials.

| Function | Runtime | Revision | Cloud Build ID | Service account | GCS source generation |
|---|---|---|---|---|---|
| usageStatus | nodejs22 | usagestatus-00021-nob | 8dc6958c-b6dc-4188-a675-2740b18f7098 | packtook-staging-runtime@packtook-staging.iam.gserviceaccount.com | 1794070024475037 |
| recordingStatus | nodejs22 | recordingstatus-00020-gof | 99c65afa-fc6c-4b17-802c-ef8517d5c47a | packtook-staging-runtime@packtook-staging.iam.gserviceaccount.com | 1794123524537203 |
| accountRole | nodejs22 | accountrole-00013-zil | df42494e-e765-43e1-855d-db894f20993b | packtook-staging-runtime@packtook-staging.iam.gserviceaccount.com | 1794280360667934 |

Full function resource prefix: `projects/packtook-staging/locations/asia-southeast1/functions/`.

Related evidence: `audit/p231/P23129_APP_CHECK_CANDIDATE_REVIEW.md`. This is three **distinct source snapshots**; do not treat their manifests as a single coherent deployed backend. Candidate static AST results are operator-reported 3/3 PASS (original FALSE vs candidate TRUE); exact diff 3/3; package manifest 3/3; SDK dependency resolution 3/3. All are local checks only.

## Outstanding required evidence

1. Exact deployed and candidate effective dependency versions and runtime artifact parity (no package-lock in archives).
2. Client App Check compatibility for every affected callable, including `accountRole`, without exposing tokens.
3. Non-public isolated staging test architecture that prevents writes to production/customer data and does not overload live Staging.
4. Valid App Check positive; missing and malformed token negative tests; confirm negative outcomes **specifically** due to App Check at known serving revision, with equivalent Auth context.
5. Security approval and deployment-specific diff before changing live staging or production.

`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_STAGING_DEPLOY=NOT_PERFORMED`
`P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
