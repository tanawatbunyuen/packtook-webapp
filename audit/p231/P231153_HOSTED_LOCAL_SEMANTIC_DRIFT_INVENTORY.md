# P231.153 — Staging hosted/local semantic drift inventory

Goal: Determine **where** hosted and reviewed staging assets diverge before proposing a canonical code change, without printing or persisting the public Enterprise site key, Firebase application identifiers, source files or secrets.

Created `audit/p231/isolated-test/p231153-hosted-local-drift-semantic-readonly.py`. It:
1. Reads `firebase-staging/firebase-packing-bridge.js`, `firebase-v4-config.js`, and `index.html` from the current Git checkout.
2. Uses read-only HTTPS GET to fetch these **public static** assets from `https://packtook-staging.web.app`.
3. Prints per-file source parity, changed line-block counts and line counts (no diffs or raw code).
4. Compares whitelisted feature flags for App Check initialization, fail-closed status wrapper, API paths, config shape, and public provider-key binding (never prints values).
5. For Index HTML compares only known script asset presence, counts of extra script references and common/unique DOM IDs; never prints unknown script URLs or DOM IDs.

Interpretation:
- A larger changed block count does **not** mean all changes are security-relevant.
- The absence of `protectedApi` in hosted bridge is not proof of App Check bypass. P231.149 observed App Check header present on normal `usageStatus` fetch, and P231.150 observed normal `usageStatus` HTTP 200.
- Local `recaptchaEnterpriseSiteKey=""` means deployment from the current checkout is unsafe until a reviewed environment-specific public site-key build step is validated.
- Source difference in `index.html` also matters: do not transplant only the site key and assume feature/UI parity.

P231.152 memory-only candidate was prepared but its **operator test result has not been received**. This next static inventory does not depend on that missing result; never mark P231.152 passed without evidence.

No active auth/appcheck exchange, cloud function calls, IAM changes, source modifications, deploy or cleanup. Production NO_GO. After the approved 2026-11-26 test window, active tests require renewed explicit approval.

P231153_SEMANTIC_DRIFT_INVENTORY=COMMITTED_AWAITING_OPERATOR_RESULT
P231153_RELEASE=NO_GO
