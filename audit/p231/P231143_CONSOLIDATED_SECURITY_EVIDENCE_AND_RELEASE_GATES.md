# P231.143 — Consolidated isolated App Check audit evidence and release gates

## Operator-confirmed P231.142 offline source verification (2026-11-26)
- P231_CHECK=ISOLATED_CALLABLE_SOURCE_DIAGNOSTIC_COVERAGE_OFFLINE
- P231_ENFORCE_APPCHECK_TRUE=PASS
- P231_PRIVATE_INVOKER=PASS
- P231_EXPECTED_RUNTIME_SA=PASS
- P231_EXPECTED_ISOLATED_EXPORT=PASS
- P231_HANDLER_CHECKS_APP_ID=PASS
- P231_HANDLER_CHECKS_VERIFIED_AUTH=PASS
- P231_HANDLER_ACCEPTS_EMPTY_DATA_ONLY=PASS
- P231_HANDLER_HAS_NO_EXPLICIT_LOGGER=PASS
- P231_NO_BUSINESS_DB_WRITES_IN_HANDLER=PASS
- P231_STATIC_FIXTURES=9/9_PASS
- P231_UNMATCHED_401_DIAGNOSTIC_CAUSE=NOT_INFERABLE_FROM_HANDLER_SOURCE
- P231142_OFFLINE_EXIT_CODE=0
- P231_WRITES=0; P231_RUNTIME_CALLS=0; P231_RELEASE=NO_GO.

These are **source-pattern static assertions** only, not complete runtime security proofs. In particular, absence of named DB-writing calls in the isolated handler is not a universal nonmutation guarantee.

## Evidence summary by phase
| Gate | Evidence | Disposition |
| --- | --- | --- |
| Staging isolated Gen2 function active, dedicated runtime SA | P231.130 operator preflight | PASS (reported) |
| Direct Cloud Run IAM no public invoker, active operator 1 | P231.128/P231.130; P231.105 prior anonymous HTTP 403 | PASS (direct-policy scope) |
| Browser genuine App Check token issuance | P231.127, token nonempty not disclosed | PASS (browser issuance only) |
| Verified-email staging test user | P231.129 browser auth, P231.130 owner attested test-only | PASS (as reported/attested) |
| Isolated callable runtime valid App Check | P231.132 HTTP 200 expected probe PASS | PASS (observed response) |
| Missing App Check | P231.132 HTTP 401 | PASS (behavior: rejected) |
| Invalid App Check | P231.132 HTTP 401 | PASS (behavior: rejected) |
| Isolated source static controls | P231.142 9/9 PASS | PASS (static only) |
| Cloud Logging request correlation | P231.139/P231.140 one of two HTTP 401 paired with App Check diagnostic via trace | PARTIAL; strict root cause INCONCLUSIVE |
| Deployed normal PACKTOOK client automatic App Check callable attachment | Not tested | OPEN |
| Production release readiness (legal/PDPA, monitoring, billing, owner signoffs, signup launch) | No new approvals inferred from this staging test | NO_GO |

## Focused recommendation, without repeated staging calls
1. Accept P231 isolated runtime **behavior** as PASS 3/3. Do not endlessly repeat requests simply to turn one missing platform log correlation into a synthetic PASS.
2. Preserve the open strict request-to-diagnostic trace-correlation evidence gap as INCONCLUSIVE (not a confirmed enforcement defect); set its closure criterion explicitly if needed for governance.
3. Audit the **deployed production/staging normal client** App Check injection and callable request path separately. Success from an independently initialized temporary browser Firebase app does not establish this.
4. Maintain controlled pilot / production NO_GO until separately authorized rollout approvals, billing/monitoring/PDPA requirements and the other tracked gates are resolved.
5. No IAM changes, public signup, new deployments or cleanup without their own approvals. The authorized 2026-11-26 Bangkok active test window must not be extended implicitly. Read-only/offline review can proceed.

## Current decision
P231143_ISOLATED_SOURCE_FIXTURES=9_OF_9_PASS
P231143_ISOLATED_HTTP_E2E=3_OF_3_PASS
P231143_PRIVATE_IAM=DIRECT_POLICY_PASS
P231143_STRICT_TRACE_ROOT_CAUSE=INCONCLUSIVE_1_OF_2
P231143_NORMAL_CLIENT_APP_CHECK_PATH=NOT_VERIFIED
P231143_ISOLATED_AUDIT=BEHAVIOR_PASS_WITH_OBSERVABILITY_GAP
P231143_PRODUCTION_RELEASE=NO_GO
P231143_IAM_WRITES=0
P231143_DEPLOY=NOT_PERFORMED
P231143_CLEANUP=NOT_PERFORMED
