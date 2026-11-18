# PACKTOOK P85 — Repository Codebase Ownership vs Live Deployment

## Key distinction

The owner-provided P84 Staging result reports all five Gen2 Functions
stable and source-pin **not shared across status and credit groups**.
Separately, the checked-out `production/firebase.json` declares
Firebase codebases `beta` (functions), `owner` (owner-functions)
and `promptpay` (payment-functions). P85 inspects all five existing
callable exports in these three checked-out source trees.

This offline audit establishes **repository-defined ownership**, not
what deploy selector safely targets the actual Staging deployment.
A distinct pinned build/source archive does not imply a distinct
Firebase codebase, and a missing codebase label does not resolve the
question.

## Safety consequence

The P81 status-handler candidate must not be deployed by blindly
replacing the `beta` Functions source directory. That directory
also defines the three critical credit callables and other functions.
A deploy operation with wrong codebase, source or selector can
affect unrelated services. No command to deploy is supplied here.

## What remains

- Independently verify currently deployed Firebase codebase ownership
  and the exact Staging callable deployment selection.
- Privately capture **and validate** immutable source/revision rollback
  restorability, not just metadata availability.
- Review service-account IAM least privilege, true backend App Check,
  positive/negative authentication tests, monitoring and owner change
  authorization.
- Staging guard drift for `recordingStatus` and `usageStatus` remains
  confirmed and **unremediated**.

P85 runs **offline only**, with no Cloud Shell commands, Cloud SDK
calls, privileges, merges or deployments. A later optional read-only
operator inspection may be designed after independent review.

`STAGING_DEPLOY=BLOCKED`; `RELEASE=NO_GO_RELEASE`.
