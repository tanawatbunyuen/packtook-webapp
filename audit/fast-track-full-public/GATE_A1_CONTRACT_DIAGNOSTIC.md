# Gate A1 — Follow-up on four actual hosted Bridge differences (2026-11-27)

The user-reported redacted source comparison returned **four different blocks** and `CALLABLE_MAPPING_EQUALS_HOSTED=NO` (exit 3), with the local candidate guarding the two protected status calls. This is **not yet evidence of a missing endpoint**, because the earlier check used a narrow regex for one client wrapper syntax.

The source differences observed in the operator's logs are categorized as:
1. Hosted-only App Check-related initialization/import in the first block;
2. App Check-related import/setup replacement;
3. Candidate-only fail-closed wrapper lines removed relative to hosted;
4. Status API call dispatch syntax changed.

Those are **coarse classifications**; they do not certify what the missing code does. The hosted bridge could not be fetched into the assistant's execution environment; thus this report does not claim an independently witnessed hosted source diff.

## Added one-pass callable contract diagnostic
`gate-a1-callable-contract-diagnostic.py` opens the pinned review ZIP and fetches only the **public hosted Bridge JavaScript**. It detects named async methods, extracts callable names using either `api`, `protectedApi`, or simple direct `httpsCallable`, and reports **only method names and callable identifiers** where their extracted contracts differ. It prints two SHA-256 hashes and labels its analysis as **regex static diagnostic**, not JS AST or behavior proof. No real Firebase calls or cloud writes.

Exit 0 = extracted method contract mappings match, **not A1 approved**; exit 3 = mapping uncertain/different; exit 2 = blocked input/network. Do not reopen archive integrity tests if the ZIP remains pinned.

## Important source risk remains
The checked-in backend declares `statusOptions={...options,enforceAppCheck:true}` and `usageStatus=onCall(statusOptions,...)`; `reserveCredit=onCall(options,...)`. Backend App Check on the latter is not explicitly enforced in reviewed source. That needs security-owner policy review and Gate B negative tests before Full Public.

## Gate decision
A1 remains OPEN, A2 PARTIAL, A3 PASS_OFFLINE_MOCK, A4 OPEN; B/C unexecuted; Full Public NO_GO. No deploy/rollback/signup change authorized.
