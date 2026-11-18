# PACKTOOK P74 — Backend App Check, IAM and Runtime Evidence Review

**Result: LIVE SECURITY EVIDENCE NOT_VERIFIED; STAGING_DEPLOY BLOCKED; NO_GO_RELEASE.**

## Facts supported by repository source

- The isolated Staging candidate in
  `production/staging-candidates/p69/functions/index.js` sets
  `enforceAppCheck:true` on its Functions v2 onCall options.
- The Production review module's shared `options` do **not** explicitly
  declare `enforceAppCheck:true`. This does not establish what backend
  policy is deployed, nor whether different callable options override it.
- P63's last operator read-only Staging attestation observed
  `recordingStatus` and `usageStatus` guard drift. This has **not** been
  cleared by later candidates or Emulator tests.
- P74 CI has deliberately **no cloud credentials, Firebase deploy action,
  Google CLI calls or live IAM access**. It cannot validate current service
  accounts, backend App Check settings, roles, policy, or deployed revision.

## Required independent Staging evidence (all initially NOT_VERIFIED)

1. App Check **deployed Functions** enforcement metadata for each of the
   five scoped callables: names, region, generation and immutable revision.
2. Independent request tests showing missing App Check AND invalid App Check
   are rejected *specifically by App Check*, not merely by Authentication
   or an unrelated Pilot Lease gate.
3. ID-token Authentication and request authorization rejection.
4. Exact project identity `packtook-staging` for each inspected resource.
5. Runtime service identity for each callable, with no default compute
   principal unless explicitly reviewed and approved.
6. Least-privilege access review, IAM bindings, and secret mounts/bindings;
   redact email identifiers and any sensitive values in shared reports.
7. Stable immutable source archive and functions configuration attested
   across repeated reads, with source change history and rollback record.
8. Pilot and Public flags proven closed; monitoring/alerting and cost
   limits independently reviewed.
9. Explicit owner and compliance approvals before any deploy.

## Operator-controlled read-only inspection (NOT run by P74 CI)

Perform in an approved **read-only operator session** after confirming the
active account has only the intended Staging permissions. These illustrative
commands must be adapted to the correct Cloud Functions generation, region
and deployed function names and must not be run with production project access:

```bash
gcloud config get-value project
gcloud functions list --gen2 --regions=asia-southeast1 --project=packtook-staging --format=json
gcloud functions describe recordingStatus --gen2 --region=asia-southeast1 --project=packtook-staging --format=json
gcloud functions describe usageStatus --gen2 --region=asia-southeast1 --project=packtook-staging --format=json
gcloud projects get-iam-policy packtook-staging --format=json
```

**Do not paste entire raw outputs into a public PR or chat**: service
identities, infrastructure metadata and IAM memberships may be sensitive.
Instead, have an independent security reviewer mark the small P74 template
fields VERIFIED/DRIFT/NOT_VERIFIED and retain signed detailed evidence in
a private change ticket.

The P74 evidence template is intentionally `NOT_VERIFIED` for everything.
A reviewer cannot simply mark all fields VERIFIED to authorize deployment;
the classifier **always** returns `stagingDeploy: BLOCKED` because current
P63 drift, release approvals, and independent attestation are separate gates.

## Follow-up gating

Before P75 can remedy the deployed Staging guard drift, require:
source/revision stability, a scoped rollback artifact, reviewed IAM/App
Check, signed owner authorization, and separate Staging-specific deploy
approval. Only then can a controlled deployment and post-deploy validation
be considered. Production remains strictly NO_GO.
