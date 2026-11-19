# PACKTOOK P101 — Actual Pinned Firebase CLI Parser (Offline)

## What is tested
This task installs the exact published `firebase-tools@15.29.0`
package in an isolated GitHub Actions runner with installation scripts
disabled, then invokes its **compiled** `functionsDeployHelper`
parser and endpoint matching routines directly using synthetic
function inventories. No Firebase CLI deploy command is executed;
no project login, OAuth tokens or Cloud requests are made.

Verified intended codebase-qualified filter:
`functions:beta:recordingStatus,functions:beta:usageStatus`.

The Firebase selector implementation matches a function ID exactly
**or a child/group ID with `targetId-` prefix**. Therefore a name such
as `recordingStatus-shadow` could also match; a string-only P100
allowlist was not sufficient. P101 explicitly fails if a synthetic
inventory would include any additional matched function, including
the three credit exports. Real inventory is NOT verified.

### Official source references
- https://github.com/firebase/firebase-tools/blob/v15.29.0/src/deploy/functions/functionsDeployHelper.ts
- https://github.com/firebase/firebase-tools/blob/v15.29.0/src/commands/deploy.ts
- https://firebase.google.com/docs/cli

## What is NOT proven
- Synthetic inventories do NOT prove actual live Staging Function
  names or deployed codebase ownership.
- Parsing filters does NOT execute a full deploy planner or show
  predicted deletions; this remains NOT_VERIFIED.
- Version pinning does not resolve missing P98 legacy account
  provisioning parity, P80 Guard Drift, source-to-revision mapping,
  backend App Check, effective IAM or known-good restore.
- Function names may migrate across codebases; the live endpoint
  labeling and deployed source must be compared before any change.
- P101 never executes `firebase deploy`, `--dry-run`,
  `functions:delete`, or production commands. Nothing is merged.

## Next necessary live evidence (read-only)
Determine the exact Staging deployed Function inventory, codebase
labels and any group/prefix collisions before approving a deploy plan.
A strictly read-only, redacted operator command is appropriate once
offline tests have passed. Never test function selection by changing
Cloud traffic or deploying source.

P101: `STAGING_DEPLOY=BLOCKED`; `RELEASE=NO_GO_RELEASE`.
