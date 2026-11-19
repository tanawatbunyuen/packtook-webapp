# PACKTOOK P100 — Exact Status Function Selector (Offline Intent Audit)

## Why P100 is not a deployment dry run

P99 confirmed the checked-out `production/firebase.json` maps the
`production/functions` folder to Firebase Functions codebase `beta`,
and that the five original exports share this codebase.

Firebase documentation supports specific named function filters in
`firebase deploy --only`:
- https://firebase.google.com/docs/cli
- https://firebase.google.com/docs/functions/manage-functions

Firebase CLI implementation also supports codebase-qualified filters,
but multi-function/codebase behavior has been a reported source of
unexpected outcomes in some Firebase CLI versions:
- https://github.com/firebase/firebase-tools/issues/7904

P100 does not assume that string syntax proves deploy boundaries.
It **does not execute** `firebase deploy`, `firebase deploy --dry-run`,
`firebase functions:delete` or any Firebase CLI command. No CLI
version is pinned or evaluated, no registry/source-to-live mapping is
asserted, and no deletion checks have run.

## Strict conceptual filter, NOT an executable instruction

The exact canonical filter intent contains only:
`functions:beta:recordingStatus,functions:beta:usageStatus`

The offline validator rejects wildcard and codebase-wide filters,
unscoped or extra functions, repeated targets, the other three
credit-critical functions, wrong project, whitespace and
shell-injection characters. The allowed string is not a deploy
command and is never passed to a shell.

Critical exclusions:
- `reserveCredit`
- `finalizeCredit`
- `recoverStaleVideoReservation`

## Release gates remaining

1. Determine a pinned Firebase CLI version; run a **genuinely offline**
   selection parser test against that version's implementation, then
   independently verify the output excludes all three credit functions.
2. Confirm Staging's deployed Function-to-codebase ownership and actual
   source/revision-to-Git mapping, including source build dependencies.
3. Resolve P99 missing-account auto-provisioning difference and narrower
   P98 Staging pilot eligibility.
4. Prove effective App Check and negative Auth tests on isolated,
   approved Staging-style fixtures.
5. Establish a reviewed immutable source-backed restoration plan,
   monitoring and a separate deployment change approval.
6. Only after these gates consider a limited Staging deployment.

The P80 Staging Guard Drift remains UNREMEDIATED; P98 is still
UNREGISTERED. No Cloud calls, writes, IAM changes, merges, deploys
or traffic changes are performed by P100. NO_GO_RELEASE.
