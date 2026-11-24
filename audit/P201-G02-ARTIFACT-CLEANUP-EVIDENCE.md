# P201 — G02 Artifact Registry Cleanup Evidence Review

## What the Cloud Operator actually supplied
- `gcf-artifacts` has a package `packtook--staging__asia--southeast1__usage_status`, updated November 14, 2026; **a package record is not evidence of any currently retained version**.
- The earlier version-list result was `[]` as reported in chat. It implies no versions visible to that read, not why they are absent.
- `firebase-functions-cleanup` policy: `DELETE`, `olderThan: 604800s`, `tagState: ANY`. The response **omits** `cleanupPolicyDryRun`; its actual value cannot be established from this excerpt alone.
- Operator's Cloud Logging query for `BatchDeleteVersions` between 2026-11-07 and 2026-11-24 returned `[]`. This means **no matching retained, visible log record for that query**; it does not establish no deletion.
- Cloud Run reported revision `usagestatus-00021-nob`, with three consistent image digest references and `Ready=True`. Cloud Build status for the pinned build is `SUCCESS`, but `results.images` was not present in operator's partial output.
- Even if 7-day policy was active, the policy alone is not proof that it deleted this exact SHA256. Cleanup execution time, version creation date, rule conflicts, permissions, log configuration and retention remain unverified.

## Release position and operational safety
This does **not** verify P188 source code deployed, App Check token controls, legacy Owner provenance or independent security signoff. G02 remains NO_GO. Do not change cleanup policies, rebuild or redeploy as part of evidence gathering.

## Read-only remaining checks (operator authorized session only)
1. Obtain explicit listing exit status and complete JSON of exact package versions; check pagination and current IAM ability to read versions.
2. Investigate independent build logs/provenance and appropriate Artifact Registry audit logging coverage; do not infer history from absent log entries.
3. Capture Cloud Run revision digest, which is available from operator-supplied output, separately from the **missing** Cloud Build output digest.
4. Require Security reviewer to attest original evidence and project identity before accepting evidence as verified.

The `audit/p201/verify.js` reconciler accepts sanitized operator metadata *offline*, marks missing fields as unknown, and explicitly refuses to conclude deletion or readiness from empty logs or versions. All source material is user-supplied and not an independently authenticated GCloud read by CI.
