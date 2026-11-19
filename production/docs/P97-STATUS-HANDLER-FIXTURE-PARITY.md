# PACKTOOK P97 — Status Handler Contract Compatibility Fixtures

## Scope

This branch adds a **standalone unregistered** status-output projection
and a hermetic fixture suite. The reference is NOT a rewritten expectation:
the tests extract and execute the exact original `usageStatus` callable
body and original supporting `creditAvailable`,
`pendingReservations`, `validCounter`, `walletEnabled`,
`periodId`, `subscriptionState` helper functions from the checked-out
`production/functions/index.js` inside a dependency-injected Node VM.

The candidate's output is compared for exact JSON field/value parity
against synthetic account fixtures spanning Free, paid, Pro, wallet,
month rollover, billing, subscription expiration, and invalid counters.
Error codes are compared for negative fixtures. No Firebase SDK is
initialized, no customer records loaded, no production data used.

## Important limitations

- These tests prove parity **only for selected existing-account fixtures**,
  for the checked-out original source. They do not prove general
  behavioral equivalence or deployed Staging source-to-repository parity.
- Original `usageStatus` calls `ensureAccount`, which may auto-create
  a legacy Beta account. This test deliberately mocks that dependency:
  it does NOT claim to preserve that provisioning behavior.
- The P81 candidate still delegates the response through its
  externally injected `usageResponse`; the new P97 projection is NOT
  wired into P81 or production. The new adapter must undergo a
  separate security/code review before integration.
- Owner/account mapping appears to be an identity mapping in the
  reviewed original repository, not proof for deployed Staging
  `recordingStatus` or Firestore data.
- P80 deployed Guard Drift remains unremediated. App Check backend,
  least privilege IAM, deployment selector, immutable known-good
  rollback and restored behavior remain NOT_VERIFIED.

No live Cloud reads/writes, deployments, IAM changes, merges, credit
handler modifications or traffic changes. `NO_GO_RELEASE`.
