# Gate B — Frontend ⇄ Backend Callable Contract Gap (source-only)

Date: 2026-11-28. Compared **feature-branch** `firebase-staging/firebase-packing-bridge.js` against `functions/index.js`. Both files inspected directly from GitHub.

## Finding: blocking for a unified source deploy
- Browser Bridge contains **28 callable call sites representing 27 distinct callable names**.
- Local `functions/index.js` has **23 named exports total**: 22 `onCall`, 1 `onRequest`.
- **Eight distinct browser callables lack a matching `onCall` export in the reviewed source**:
  - `inviteOperator`
  - `acceptOperatorInvite`
  - `listOperators`
  - `requestDuplicate`
  - `myDuplicateRequests`
  - `listDuplicateRequests`
  - `approveDuplicateRequest`
  - `operatorApprovalStatus`

The backend exports `authorizeDuplicate`, which the Bridge also calls; this **does not** substitute for the eight missing role/approval APIs. Owner analytics and `billingHistory` are backend-only/other-client APIs and are not evidence of missing browser behavior.

## Meaning and risk
This is **confirmed feature-branch source contract drift**. It is NOT proof that the currently deployed Staging project lacks those Functions: independently deployed endpoints/other source modules or hosting revisions may exist, and live Functions metadata has not been queried. The separate release-branch Hosting ZIP is unchanged.

If the candidate is deployed exactly as this source with no additional Functions supplying those names, operator management and duplicate-barcode request flows may fail at runtime.

## Gate and recommended resolution
1. **Do not deploy the backend candidate as a complete replacement yet.** Do not blindly add stubs; doing so could overwrite existing production behavior or undermine authorization.
2. Resolve which source of truth implements the eight handlers. Inspect the real Staging **read-only Functions inventory** under separately scoped access; match deployed function name, region, trigger type, revision, source provenance, App Check enforcement, and tenant security. Do not use deployed status as permission to modify it.
3. If existing handlers have separate maintained source, incorporate and review them in one unified candidate; otherwise implement correct tenant-scoped/owner-scoped workflows and add Emulator tests before staged release.
4. For approved staging testing, include negative tests for cross-tenant operator invitation, approval reason, old/invalid approval, duplicate barcode override and denial for unverified email.
5. Only rerun exact tests affected by changes. Current 22/22 App Check and Client mock results remain historical evidence for the old source revision, not a complete new release certification.

## Read-only reproducibility
```bash
node --check audit/fast-track-full-public/gate-b-frontend-backend-contract.cjs
node audit/fast-track-full-public/gate-b-frontend-backend-contract.cjs
echo "PACKTOOK_API_CONTRACT_EXIT=$?"
```
Expected `PACKTOOK_BROWSER_CALLABLE_REFERENCES=28`, `PACKTOOK_BROWSER_UNIQUE_CALLABLE_NAMES=27`, `PACKTOOK_DUPLICATE_CALLABLE_BINDING_NAMES=subscriptionOverview`, and `PACKTOOK_BROWSER_MISSING_LOCAL_EXPORTS=8`, `PACKTOOK_API_CONTRACT=BLOCKED_SOURCE_EXPORT_GAP`, exit 3. A zero exit is possible only when all 28 frontend names are satisfied by the inspected local exports and unchanged scanner assumptions.

**Gate B = OPEN; Full Public = NO_GO. No deploy/cloud writes/signup change.**

## Scanner correction — 2026-11-28
The original assertion expected 28 **unique** names and failed before printing the actual API gaps. Independent Source reinspection confirmed 28 call sites but 27 unique names: `subscriptionOverview` appears in two bridge methods (subscription view plus history access). The separate `billingHistory` backend export is not invoked by this Bridge. The 8 actual locally missing export names above are unaffected. The fixed scanner records both counts and preserves fail-closed exit 3. No deployment is implied.
