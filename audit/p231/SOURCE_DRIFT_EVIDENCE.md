# P231.6 — Operator-observed staging source hashes
Date: 2026-11-25, staging only. Evidence class: OPERATOR_CLOUD_READ_ONLY.
Expected P188 candidate SHA256: c599056ccc227ffbf76fd9d582ecbd3cec1bf516437e72b0d097ac2e07a3978b

| Function | Runtime revision | Observed index.js SHA256 | Compared with P188 |
| --- | --- | --- | --- |
| usageStatus | usagestatus-00021-nob | 25d4550e989b4a4a88eacc011db8f6733a2f3cd322d09db0e33168541df15cd3 | DIFFERENT |
| recordingStatus | recordingstatus-00020-gof | 9505852f7dda3c3d4060abad4b514f2cd744d5edd98c8e610a9386caf4c46d20 | DIFFERENT |
| accountRole | accountrole-00013-zil | 9a7b82c11272685e77be529d74c453016a74e8f7368335840e58812cf2e14b20 | DIFFERENT |
| ownerGrantVideoCredits | ownergrantvideocredits-00001-nuq | 3dae1d9541d796ac48f316f6b128e92a394b917f3ff4b7a4d2157c6ffcfc8b8d | DIFFERENT |

Hash method: operator-provided Cloud Shell output comparing bytes of index.js inside each pinned Cloud Functions source storage object generation.
IMPORTANT: A mismatch proves byte inequality only, not compromise or absence of specific guards. Function archives may have originated from different releases. This is not independent verification of source bytes by this reviewer.
P227–P229 G02 isolated probe evidence remains PASS, does not attest these four application functions.
App Check 3-way E2E and deployed backend security authorization remain NOT_VERIFIED. P189 historical release tracks still 4/8 PASS.
Release: NO_GO. No changes to deployment, IAM, customer data, public signup or production.

Next: run only bounded, non-secret static marker inspection of these pinned archives; no raw source output. Examine account-role authorization, App Check enforceAppCheck assignments, owner credits exports/guard. Require independent review of exact source and runtime tests before signoff.
