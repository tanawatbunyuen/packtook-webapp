# PACKTOOK P95 — Source-first Recovery Preflight (No Cloud Work)

## Staging evidence carried forward, not overstated

- P88: original `recordingStatus` and `usageStatus` CURRENT pinned
  source ZIPs were both readable in memory; this does not verify
  source-to-Git parity or immutable known-good prior source.
- P90: current visible Cloud Run history 20 and 21 revisions, all with
  Ready/creation/image metadata.
- P91/P92: 41 distinct historical image references, all digest-pinned.
- P93C/P93D: current `recordingStatus` image digest lookup returned
  `IMAGE_OR_REPOSITORY_NOT_FOUND` while repository metadata was
  readable; current Function metadata remained stable.
- P94: independent package version lookup for current
  `recordingStatus` returned `PACKAGE_VERSION_NOT_FOUND_OR_HIDDEN`.
  **Do not conclude that the image was deleted**: the lookup path or
  current identity could affect these results. `usageStatus`
  Registry was not tested.
- P80: original deployed status-security guard drift still
  `UNREMEDIATED`.

## Why source first is the safer next action

Cloud Run documentation says revision objects can remain while image
registries and deployments evolve. Traffic rollback to old revisions
can cause live routing changes without revalidating dependencies.
Therefore, do NOT test restoration by switching any traffic or
redeploying an arbitrary older image.

P95 restricts the change-scope analysis to:
- `recordingStatus`
- `usageStatus`

and explicitly excludes credit-critical Functions:
- `reserveCredit`
- `finalizeCredit`
- `recoverStaleVideoReservation`

Priority is offline reconstruction and review:
1. Confirm exact candidate handler diff of P81/P82 relative to the
   pinned P88-current source; never infer it from a Git branch alone.
2. Identify offline safe Firebase functions-scoped selector and
   deployed codebase ownership, including potential collateral
   credit-handler re-deploys.
3. Validate fixes and negative Auth/App Check cases in a strictly
   isolated Emulator with no real user/credit data.
4. Establish a known-good immutable source and reproducible candidate
   build independently. If historical image can no longer be verified,
   prefer a newly built, reviewed isolated staging candidate over
   blindly selecting any old revision.
5. Run recovery drill only in a separately authorized, isolated
   environment. Obtain a release/change approval before live Staging
   deployments, any traffic shift, IAM or Production changes.

## P95 implemented validation

A fail-closed Node gate freezes all owner-supplied P88-P94 observations,
enforces the two status target / three credit exclusions, and refuses
to reinterpret NOT_FOUND, NOT_VERIFIED or P80 drift as approval.
Hermetic CI only. No Cloud calls, writes, traffic, IAM or deployment.

No new Cloud Shell command is required for P95.
`STAGING_DEPLOY=BLOCKED`. `RELEASE=NO_GO_RELEASE`.
