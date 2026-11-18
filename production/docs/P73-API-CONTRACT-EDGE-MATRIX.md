# PACKTOOK P73 — API Contract & Edge Matrix

**Status: REVIEW CANDIDATE, NO DEPLOY. Full parity and live App Check NOT_PROVEN.**

## Scope

P73 compares static API export mappings and `usageStatus` /
`recordingStatus` response key names between the Production review module
and P72 Staging candidate. It adds negative mutation checks detecting
missing response keys, missing Callable registrations and missing explicit
`enforceAppCheck:true`.

The real local Firestore Emulator is used for wallet/month boundaries,
simultaneous finalize requests, simultaneous stale recovery versus
finalize, unknown-plan fail-closed behavior, and corrupted reserved counts.
P70-P72 credit tests continue to run.

## Known limitations

- API source-shape matches do **not** prove that the web frontend has
  migrated to new function names, that all optional fields have equivalent
  runtime types, or that responses are equivalent in a deployed project.
- P72 intentionally requires pre-provisioned Staging Pilot accounts;
  Production Beta may auto-provision them. This needs client acceptance.
- P70 credit handlers remain rewritten candidates; partial edge coverage
  is not comprehensive semantic equivalence.
- True Firebase authenticated **positive** Callable transport test with
  valid App Check attestation remains unproven.
- P63 deployed Staging callable guard drift remains unresolved, and
  production public signup / billing / security / owner approvals remain
  pending.

## Release gates

`P73_API_STATIC_CONTRACT=MATCH_CANDIDATE` can coexist with
`P73_RUNTIME_PARITY=REVIEW_REQUIRED`. This is intentional.
No production index edits, no Cloud reads/writes, no merge, no deploy.
`RELEASE=NO_GO_RELEASE`.

Next P74 should focus on independent backend App Check/IAM
read-only evidence and approval-controlled Staging deploy preflight,
not claiming that a local Emulator CI green signal is a deployed fix.
