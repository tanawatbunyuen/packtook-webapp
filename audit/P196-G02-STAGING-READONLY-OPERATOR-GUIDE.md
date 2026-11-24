# P196 — Authorized Staging Read-only Runtime Inspection

**Mode:** REVIEW_ONLY. No live Staging query performed by developer or GitHub CI. All G01–G08 release gates remain NO_GO.

## Deliverable
`audit/p196/operator-readonly-runtime.js` implements a strictly guarded, **operator-invoked** source of G02 runtime inventory metadata for one function only: `projects/packtook-staging/locations/asia-southeast1/functions/usageStatus`. It invokes only the fixed read-only Google Cloud CLI command:
```bash
gcloud functions describe usageStatus --gen2 --project packtook-staging --region asia-southeast1 --format=json --quiet
```
This command is an operator-scoped read of function metadata, **not** a production deployment or proof that the P188 source code is installed in Staging. It does not access Firestore accounts and does not request App Check tokens.

## Independent operator prerequisites
The Cloud Operator must independently receive explicit authorization to read Staging metadata, select an already existing least-privilege authenticated GCloud profile with appropriate access, and record the independently issued G02 change ticket. Environment variable strings are safety checks, **not proof of authorized identity**. Do not put tokens or secrets in source, PR descriptions, logs or conversation.

After independent authorization, the operator may run this **outside GitHub CI**:
```bash
export PACKTOOK_G02_OPERATOR_APPROVED_PROJECT=packtook-staging
export PACKTOOK_G02_OPERATOR_CHANGE_TICKET=G02-REPLACE-WITH-APPROVED-TICKET
export PACKTOOK_G02_P196_READ_ONLY_ACK=I_AUTHORIZE_P196_STAGING_METADATA_READ_ONLY
node audit/p196/cli.js --project=packtook-staging --read-only
```
The output is sanitized classification only, with no provider response, revision string, environment, service account identity, or credentials. If the actual function is Gen1, Gen2 name differs, the callable URL is a Cloud Run URL, the revision is missing, or the operator discovers drift, stop and have Security review the source-of-truth. Do not automatically accept an unexpected origin or substitute production.

## Required independent evidence still absent
- The GCloud function runtime metadata itself is not currently checked against a real deployed source artifact or Cloud Build provenance. A claimed source SHA in repository metadata does not prove a deployed hash.
- Authorized P186 aggregate read-only staging account inspection.
- Authorized P187 real staging App Check positive and negative test.
- Reconciliation P195 and human security reviewer independently verify exact runtime revision and sources.
- Separate P190 production inventory and independently verified historical owner provenance before G02 can be closed.

CI only tests mocked function metadata and denies all CI cloud calls, then runs P195/P189/P190 safety fixtures and G01–G08 NO_GO gates. Never merge/deploy, migrate accounts, enable public signup, import recovered Owner code or relax security policy based on P196.
