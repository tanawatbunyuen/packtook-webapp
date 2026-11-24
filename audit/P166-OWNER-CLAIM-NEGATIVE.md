# P166 — Source-extracted owner-claim negative tests (offline only)

P165 real Cloud Shell static audit completed with six review items and two present ownerAnalytics callables; it intentionally returned `NO_GO_BACKEND_AUTH_REVIEW_REQUIRED`.

This P166 adds a **strictly local**, hash-pinned (`functions/index.js` Git blob `92262ea2fbbb941188937d72f0eea74a735d2bf3`) test of the **two tiny source-extracted guard functions only**: `uid(req)` and `requirePlatformOwner(req)`. Node's `vm` executes those snippets with only a mock `HttpsError`, a finite timeout and no `require`, Firebase SDK, filesystem API, credentials, network or recovered functions exposed within the VM. The complete `functions/index.js` is **never loaded or imported as executable code**.

The script also requires a visible, first-statement `requirePlatformOwner(req)` in two present source ownerAnalytics callables and fails closed if any of the four previously missing recovered Owner handlers appear. This is lexical evidence, not full control-flow review. Eight mock cases include signed-out, unverified email, missing/false/string claim, customer-admin-only, forged request payload, and legitimate synthetic Owner claim. It neither sets real custom claims nor reads real user records.

### Cloud Shell offline run
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p166-owner-claim-negative-fixtures
if [ ! -d "$HOME/packtook-p166" ]; then
  git worktree add --detach "$HOME/packtook-p166" origin/review/p166-owner-claim-negative-fixtures
fi
cd "$HOME/packtook-p166"
node audit/p166-claim-fixtures.js
node audit/p166-owner-claim-negative.js
```

Expected `P166_OFFLINE_FIXTURES=4/4_PASS`, `P166_NEGATIVE_AND_POSITIVE_MOCK_CASES=8/8_PASS`, `P166_DECISION=NO_GO_RUNTIME_AUTHORIZATION_REVIEW_REQUIRED`.

Important remaining gates: **real deployed** Functions revision provenance, full call path authorization-before-read/write, real or emulator-only callable negative tests against explicitly approved non-recovered candidates, four recovered missing Owner Function source identity and provenance attestation, backend Admin SDK tenant isolation, production Rules provenance, App Check/IAM and legal/operational readiness. A successful P166 mock is NOT Owner authorization approval.

**NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.**
