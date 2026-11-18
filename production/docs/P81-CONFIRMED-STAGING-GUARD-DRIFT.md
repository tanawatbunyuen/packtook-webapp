# PACKTOOK P81 — Confirmed Staging Guard Drift Remediation Candidate

## Owner-supplied P80 source evidence (November 18, 2026)
The P80 operator read a pinned Staging source archive in memory for two
callables and checked metadata stability for all five. Result:
- `recordingStatus`: `DRIFT_REVIEW_REQUIRED`
- `usageStatus`: `DRIFT_REVIEW_REQUIRED`
- all-five revision stability: YES
- backend App Check: NOT_PROVEN
- least privilege IAM: NOT_VERIFIED
- cloud writes/deploy: zero; release: NO_GO_RELEASE

The archived deployed status-handler guard does not satisfy the exact
reviewed guard/dependency check. This is real **source drift** evidence,
not proof of a demonstrable exploitable vulnerability. It does **not**
demonstrate that any live authenticated request has successfully bypassed
policy.

## P81 code

`production/staging-candidates/p81/legacy-status-live-gate-candidate.cjs`
builds both *original* status callable names with the P65 Staging
authorization gate, `onCall({enforceAppCheck:true,...})`, live Auth user
validation, Pilot Lease, app ID, session and environment checks. It
requires the user's actual authenticated UID for Firestore account lookup.
If the policy gate throws, neither status handler reads a customer account.

This is **an isolated unregistered review candidate**, deliberately NOT
imported in the main Firebase Functions entry point or deployed runtime.
The P75 and P69 review candidates are not independently deployable
without owner-approved migration and rollback.

## P81 test boundary

The tests use dependency-injected mock onCall/Auth/Firestore to verify
denials before customer account lookup and successful authorized
read-only behavior. They do not prove true backend App Check enforcement,
Cloud Function runtime equivalence or live IAM. The P80 operator evidence
is recorded as a strictly bounded result: no raw source, principal IDs,
archive URLs, secrets or hashes committed.

## Next actions

1. Independent review of confirmed drift and the narrow status-function
   remedial patch (avoid replacing the credit callables unintentionally).
2. Confirm precise deployed handler dependencies and a Staging-only
   implementation and codebase plan that preserves current customer
   contract, with immutable rollback revisions.
3. Obtain real IAM least privilege and App Check enforcement evidence,
   incident/monitoring coverage and owner deployment approval.
4. Only after separate explicit approval consider limited Staging deploy.
   Post-deploy run P80 pinned-source attestation, positive/negative
   authenticated App Check tests, and preserve rollback paths.

**P81 does not deploy and does not close the live drift.**
`STAGING_DEPLOY=BLOCKED` and `RELEASE=NO_GO_RELEASE`.
