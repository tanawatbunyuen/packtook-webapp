# PACKTOOK P78 — Consolidated Pilot Preflight and Operator Handoff

P78 combines **P74 Security (17)**, **P77 Operations (18)** and the
existing P70 `deployAllowed:false` manifest. It is an OFFLINE review
gate only. It never authorizes a deployment, even if all template fields
are marked VERIFIED. P63 deployed Staging guard drift remains open.

## Evidence classification

- P74 security: backend App Check, IAM/service identities, source
  revision, consent and owner approvals **not verified**.
- P77 commercial operations: Omise Test 404 issue, settlement, billing
  alerts, restore drills, incident drills and PDPA **not verified**.
- P76 is a synthetic local workflow. It is not evidence of a real
  Omise charge, video file or Cloud Function authorization.
- P63 existing Staging guard drift remains UNRESOLVED.
- Pilot and Public remain NO_GO pending live proof and approvals.

## Optional owner-run Cloud Shell inspection

The separate `production/scripts/p78-staging-metadata-readonly.py`
is an **operator-only** script that queries five named Functions Gen2
metadata using `gcloud functions describe` and prints a small
redacted status report. It never exports secrets, full IAM policies,
environment variable contents, source archives, service account IDs,
access tokens or URLs.

Only in an explicitly approved operator Cloud Shell, from a clean
checkout of this P78 review branch:

```bash
python3 production/scripts/p78-staging-metadata-readonly.py --inspect
```

This script requires the active gcloud project to be exactly
`packtook-staging`, does not change gcloud project selection, uses
read-only describe APIs, and does not deploy. If Cloud Functions names
are absent or permissions are insufficient it reports NOT_VERIFIABLE.

**Metadata alone is not App Check enforcement proof** and cannot
establish an accurate deployed code wrapper or least-privilege IAM.
Those require separate scoped attestation and independent validation.

## Exit status

No Staging deploy, no public signup, no Production release.
`NO_GO_CONTROLLED_PILOT` / `NO_GO_RELEASE`.
