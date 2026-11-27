# PACKTOOK Gate B — Read-only source risk disposition and integrated E2E scope

Date: 2026-11-27. **Source inspection only — NOT real runtime verification.** No staging/production deployment, public signup changes, Firebase calls or cloud writes authorized.

## Operator evidence received
Gate B backend policy scanner syntax PASS, exit 0:
- Total 23 named handlers: 2 callables on `statusOptions`, 13 on base `options`, 7 on other options, and 1 HTTP handler.
- Explicit status App Check handlers: `usageStatus` and `recordingStatus`.
- Sensitive base options include `reserveCredit`, `finalizeCredit`, `registerDevice`, `requestPlanChange`.
- `PACKTOOK_APPCHECK_ALL_HANDLERS_ENFORCED=NOT_ESTABLISHED`; deployed runtime not verified.

## Additional independent direct repository inspection
Source: `functions/index.js`, GitHub blob SHA `92262ea2fbbb941188937d72f0eea74a735d2bf3`.

1. `const paymentSecrets={region,timeoutSeconds:30,secrets:[omiseKey]};` — no explicit `enforceAppCheck` in the source options object. `createOmisePayment`, `recoverOmiseCharge`, `omisePaymentStatus`, `paymentAudit` use this options object.
2. `omisePaymentConfig` uses an inline options object with `omisePublicKey`; it invokes `uid(req)`.
3. `omiseAPI()` rejects missing keys and requires a secret prefixed `skey_test_` in the inspected source. This suggests test-mode-only behavior in the code snapshot; no provider call was made and no deployed key was inspected.
4. `omisePaymentWebhook` is `onRequest` with `invoker:"public"` in source and shows POST restriction, timestamp freshness checks and HMAC signature verification using an application secret. Public invocation can be intentional for provider webhooks. Signature checks must be verified with negative/replay tests; the presence of code alone does not prove effectiveness.
5. `ownerOptions={region,maxInstances:2,timeoutSeconds:180,memory:"512MiB"}` lacks explicit App Check enforcement in source. Owner analytics handlers call `requirePlatformOwner(req)`, which checks `req.auth.token.packtookPlatformOwner===true` and invokes `uid(req)` to require verified Auth. Verify revocation, token freshness and claim isolation in Gate B.
6. The base `options` is also not explicitly App Check enforcing. The observed heterogeneity in backend policy means it would be inaccurate to claim universal App Check enforcement solely because the client initializes App Check.

## Security disposition for Full Public
- **B2 remains OPEN**: require signed request-correlated real staging evidence for protected vs unprotected callable paths. Policy owner must decide which endpoints require `enforceAppCheck:true` and document any compensating abuse controls for exceptions (e.g. webhooks).
- **B3 remains OPEN**: independent tenant-boundary and owner-claim tests with synthetic accounts.
- **B4 remains OPEN**: credit reserve/finalize concurrency, idempotency, and device authorization must be proven.
- **B5 remains OPEN**: Omise staging 404 incident remains unresolved and sandbox payment lifecycle, verified webhook, replay protection and reconciliation must pass.
- A source-only security scan is not a substitute for Gate B's registered-origin test. Preserve Gate A2/A3 prior PASS within their exact scopes. Do not redo their artifact/browser mock tests without material change.

## One-window scoped test prerequisites
Fresh separate owner approval covering staging project/Hosting preview origin, test user identities, resource writes, Omise Test Mode scope, rate/credit limits, cleanup, reviewers and any public-domain registration. No authorization for production, public signup or live payments. Full Public stays **NO_GO**.
