# P231.172 — Fail-closed Bridge negative regression fixtures (offline)

## Operator-confirmed P231.171
The candidate was served over a localhost-only HTTP server: 12 candidate Hosting files returned HTTP 200 with exact expected bytes. Five versioned script references were present, the Firebase SDK import allowlist passed, the source fail-closed guard was preserved. Exit 0. JavaScript was **not executed in a real browser**; real App Check token attachment for the candidate is still unverified.

## New P231.172 test
`audit/p231/isolated-test/p231172-bridge-guard-negative-fixtures.cjs` is an **offline Node.js VM** test of the checked-in staging bridge; only the five static ES-module import lines are removed and SDK entry points supplied by in-memory mocks. No real Firebase SDK is loaded, no Browser APIs or network are used. The fixture intentionally tries both safe and unsafe states:

1. Empty Site Key rejects `usage()` with the expected fail-closed error.
2. Empty Site Key rejects `recordingStatus()`.
3. Whitespace-only Site Key likewise blocks both protected status methods.
4. Empty-key execution neither invokes mocked status callables nor initializes mock App Check.
5. A fake, **non-real** mock key initializes mocked App Check once and dispatches both status methods to mocked `httpsCallable`.
6. Two **deliberately tampered in-memory** source variants replace one protected call at a time with bare `api`; the test confirms these negative fixtures would bypass the missing-key guard, demonstrating why keeping the guard is necessary.

These are 10 **offline mock behavior** assertions. This test does not validate the signed App Check token, real Firebase functions, hosted App Check enforcement, reCAPTCHA domain registration or a candidate release. It writes no source, credentials or assets. It fails closed if the expected source import/guard shape changes.

Expected outcome: `P231_NEGATIVE_FIXTURES=10/10_PASS` and Exit 0. A passing result means the mock fixture distinguishes guarded behavior from a deliberately broken wrapper; it is **not** production approval.

The P231.170 build reproducibility and JS syntax checks passed, and P231.164 Hosting live-version pin was metadata-verified. The candidate artifact still is not persisted and no rollback exercise or real candidate browser runtime has been completed. Keep staging Hosting blocked and production NO_GO.

P231172_NEGATIVE_FIXTURES=PREPARED_AWAITING_OPERATOR_RESULT
P231172_REAL_BROWSER_RUNTIME=NOT_VERIFIED
P231172_RELEASE=NO_GO
