# PACKTOOK Fast Track — Isolated App Check backend enforcement candidate

**Review-only feature branch:** `feature/fast-track-appcheck-enforcement-candidate` (branched from `review/p231-appcheck-runtime-readiness` on 2026-11-27).

**No deploy performed, no merged release, no production or staging change.** This branch is **NOT** the pinned 12-file Hosting candidate and must not be silently substituted for its ZIP.

## Concrete code changes in `functions/index.js`
- Add `enforceAppCheck:true` to base `options`, therefore all base-options callables (including credit reserve/finalize, devices and subscriptions) explicitly enforce App Check if this source is eventually deployed.
- Keep `statusOptions` explicit enforcement; add to `paymentSecrets` and `ownerOptions`.
- Add enforcement to inline `omisePaymentConfig` callable.
- **Do not add App Check** to the publicly invoked **HTTP Omise webhook** because it is not called from the Firebase browser SDK; its independent HMAC signature verification, replay controls and provider verification must be tested.
- **Do not enable live Omise**; the existing `skey_test_` guard and `livemode===false` checks remain. Paid Full Public release therefore still requires a separately reviewed live-payment design, provider validation and legal approval.

## Source test
Run in the feature branch, in an isolated local checkout:
```bash
node --check functions/index.js
node --check audit/fast-track-full-public/gate-b-appcheck-candidate-regression.cjs
node audit/fast-track-full-public/gate-b-appcheck-candidate-regression.cjs
```
Expected: `PACKTOOK_SECURITY_CANDIDATE_SOURCE_REGRESSION=PASS`, `22/22` explicit App Check policy, one signed webhook HTTP exception.

Tests are **static policy checks**. They do not validate actual deployed endpoint effective options or substitute for Firebase Emulator/registered staging origin request tests.

## Deployment and operational compatibility blockers
1. Enforcing App Check on 22 callable endpoints **can break existing hosted clients** that lack a current registered reCAPTCHA Enterprise site key, invalid browser tokens, or SDK initialization. Do not deploy backend candidate ahead of compatible client staging candidate. Existing staging source config has an empty key, while the review-only Hosting ZIP injects a public staging key only temporarily.
2. Execute an isolated Emulator regression for credit idempotency/recovery and account/tenant authorization, then an explicitly authorized staging registered-origin App Check valid/missing/invalid token matrix, including every payment callable. Request-correlate logs.
3. Confirm Cloud Functions environment and SDK App Check support and current deployed runtime policies; this source branch is not deployment proof.
4. Deliberate no-App-Check exceptions must be security reviewed: signed HTTP webhook and any genuine non-browser integration.
5. Public signup handler/control appears outside the reviewed `functions/index.js`; live metadata inventory under a separately scoped read-only authorization is required before launch.
6. Omise historical 404 must be root-caused in staging Test Mode. The source cannot process live payments until an independently reviewed live flow exists.
7. Any promotion of this candidate requires change approval, new artifact/source pin, new Browser + Backend integration tests, Gate A A1/A2 reassessment, rollback pin and fresh Gate B/C sign-off.

## Scope and decision
This isolated branch is a **concrete security improvement proposal** and not the approved Full Public release. Do not merge to the reviewed release branch until the security owner reviews the App Check policy and a compatible deployment order. `FULL_PUBLIC=NO_GO`.

## 2026-11-28 Client compatibility hardening (feature branch only)
- Changed `firebase-staging/firebase-packing-bridge.js` to **fail closed for ALL client callable dispatch** if the staging public reCAPTCHA Enterprise site key is blank. Previously only the two status wrappers had a local guard, even though the proposed backend candidate requires App Check on 22 callables.
- The public site key is still intentionally **blank in the checked-in staging config**; this feature branch cannot be used as a working deployed client without an owner-reviewed staging site key and verified registered origin. Do not inject private credentials or promote the test branch automatically.
- Added `gate-b-client-backend-compatibility.cjs` which uses a Node VM and **mock Firebase SDK** to ensure the 30 async methods / 28 static callable mappings remain, seven representative calls fail closed without a key (zero dispatch) and six dispatch with an artificial key. These checks prove *client wiring behavior*, **not real reCAPTCHA token issuance**, backend acceptance, or any deployed compatibility.
- The existing PINNED review-only Hosting ZIP on the release branch remains unchanged. A combined client/backend release would require a **new Candidate pin**, immutable Hosting package, source diff review and Gate A tests for the new artifact.

Offline operator commands on a detached feature worktree:
```bash
node --check functions/index.js
node --check firebase-staging/firebase-packing-bridge.js
node --check audit/fast-track-full-public/gate-b-appcheck-candidate-regression.cjs
node --check audit/fast-track-full-public/gate-b-client-backend-compatibility.cjs
node audit/fast-track-full-public/gate-b-appcheck-candidate-regression.cjs
node audit/fast-track-full-public/gate-b-client-backend-compatibility.cjs
```

A regression exit zero does not change Gate A/B/C or Full Public NO_GO. No IAM, Firebase, Omise or signup writes are authorized.
