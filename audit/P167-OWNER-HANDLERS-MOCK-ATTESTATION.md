# P167 — Two existing Owner Analytics handler bodies, simulated datastore

The prior P166 operator execution passed 4/4 offline integrity fixtures and 8/8 source-extracted Owner claim cases. It was NOT callable runtime verification.

P167 uses a pinned exact Git blob of `functions/index.js` (`92262ea2fbbb941188937d72f0eea74a735d2bf3`) and extracts **complete** `ownerAnalyticsSummary` and `ownerAnalyticsCustomers` body definitions, plus the `uid(req)` and `requirePlatformOwner(req)` guards. JavaScript VM runs only these snippets with an in-memory instrumented fake Firestore Admin SDK and Authentication directory. The rest of `functions/index.js` is never imported or evaluated; recovered Owner handlers are never imported.

For both handler bodies P167 verifies 6 denial scenarios (signed out, unverified email, customer-level admin only, false/string Owner claim, forged Owner payload) and asserts **zero** privileged datastore or user-directory calls when denied. A separate synthetic valid Owner claim must reach the stub datastore and return an empty mock response (no real customer details). These are 12 negative and 2 positive offline assertions, not network or real Firebase callable tests.

Cloud Shell:
```bash
cd "$HOME/packtook-webapp"
git fetch origin review/p167-owner-handlers-mock-datastore
if [ ! -d "$HOME/packtook-p167" ]; then
  git worktree add --detach "$HOME/packtook-p167" origin/review/p167-owner-handlers-mock-datastore
fi
cd "$HOME/packtook-p167"
node audit/p167-handler-fixtures.js
node audit/p167-owner-handler-mock.js
```

Expected `P167_OFFLINE_FIXTURES=4/4_PASS`, `P167_NEGATIVE_AUTH_BEFORE_DATA=12/12_PASS`, `P167_POSITIVE_OWNER_EMPTY_MOCK=2/2_PASS`, `P167_DECISION=EXTRACTED_HANDLER_AUTH_GATES_ATTESTED_RUNTIME_NO_GO`.

**Limitations:** Direct invocation of VM-extracted handler functions is not real Firebase Callable HTTP/SDK runtime validation; the mocked datastore does not prove data filtering correctness or tenant isolation for nonempty datasets; Firebase Functions SDK App Check, IAM, verified custom claims, real deploy, or Owner recovered source provenance are not attested. No public endpoint, no cloud calls, no auth account mutations, no Owner source import.

NO_GO_OWNER_IMPORT / NO_GO_DEPLOY.
