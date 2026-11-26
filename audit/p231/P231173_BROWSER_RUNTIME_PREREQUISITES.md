# P231.173 — Candidate browser runtime prerequisite boundary

## Operator-confirmed P231.172 result
P231.172's **ten offline VM/mock negative fixtures passed** with exit 0. The empty/whitespace App Check key blocked both protected status methods before mock callable dispatch; mock-key initialization and calls worked; deliberately tampered in-memory bridge methods were detected. There was **no real Firebase SDK, App Check token, browser execution, cloud write or deploy**.

Prior findings: P231.170 two reproducible transient candidate builds and 6/6 JavaScript syntax checks, P231.171 12/12 loopback HTTP asset byte-delivery checks with SDK import graph allowlist. None proves candidate browser/runtime compatibility.

## P231.173 offline check
`audit/p231/isolated-test/p231173-browser-runtime-prerequisite-gate.py` inspects **only local** source and available executables: Chromium-family browser, Node, npm, and whether a Playwright Node package can be resolved. It does not launch a browser, install packages, make network requests, execute JavaScript from the frontend, inspect local browser profiles or request Firebase tokens. The configured empty repo site key and guarded bridge status calls must remain unchanged.

Its exit code 0 denotes **successful prerequisite inspection only**. Browser runner availability does not establish permission to start a candidate on a registered App Check origin.

## Browser runtime evidence must be split into two honest gates
**A. Isolated mocked browser smoke (safe candidate sanity):**
- Build a reviewable test artifact; use a new disposable local browser profile.
- Intercept all external network and supply explicit Firebase SDK mocks. Verify module execution, bridge export, expected UI initialization, fail-closed missing-key behavior, and absence of any unexpected network attempts.
- Test under loopback only without using a *real* App Check key or token.
- Run only if a supported local runner is available. Do not treat this as live Firebase compatibility.

**B. Real Firebase browser runtime (separate authorized staging test):**
- Use an owner-verified test account and **registered test origin**, hosted behind a reviewed isolated preview Hosting channel or another approved Firebase App Check domain.
- Confirm actual App Check header presence, read-only protected status HTTP response, allowed Auth and expected user behavior, with no personal tokens printed.
- Preview Hosting or other cloud operations require explicit scoped authorization and rollback/release preparation, despite separate staging-only intended scope.
- Do not attempt a real token from arbitrary localhost, bypass reCAPTCHA domain registrations or trigger billing, recording/credit, account mutation or public signup flows.

## Remaining blockers
The repo config still has a blank public Enterprise site key, while the existing Hosted Staging Bridge uses a different binding. The P231.169 candidate was discarded after test; no persistent, reviewed candidate artifact; no actual candidate browser smoke; no validated Hosting rollback execution; and no scoped staging Hosting deployment approval. P231.164 pinned release metadata was validated but not proof of restorable backups. Production remains NO_GO and signup closed.

P231173_BROWSER_RUNNER_READINESS=AWAITING_OPERATOR_RESULT
P231173_RUNTIME=NOT_VERIFIED
P231173_DEPLOY=NOT_PERFORMED
P231173_RELEASE=NO_GO
