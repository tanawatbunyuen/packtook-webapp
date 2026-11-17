# V7 Handler Semantic Attestation — controlled Staging only

Prior evidence: five credit/recovery callables ACTIVE; five distinct deployed source artifacts; all five source archive handler files DRIFT against the reviewed branch. Frontend App Check initializes on Staging but backend enforcement NOT PROVEN.

## Design
- Read exactly five pinned generation Source ZIP archives via trusted operator Cloud Shell, in RAM only.
- Inspect only `index.js` or `functions/index.js` ZIP member; no source or ZIP persisted or output.
- Require explicit `--inspect-source` and Staging-only environment/project guards.
- Compare exact exported handler bodies per function; also compare the ENTIRE module because equal handler bodies with differing shared helpers are not semantically equivalent.
- Report static *signals* for tenant authorization, device validation, idempotency, duplicate lock, credit reserve/return, recovery age/confirmation and file evidence. Signals are not proof.
- Resolve simple `onCall(options,...)` or inline object literal `enforceAppCheck` declarations conservatively. Dynamic, conditional or per-export options remain unresolved; **no code-signature observation proves effective enforcement**.
- No invocation of `reserveCredit`, `finalizeCredit`, Auth, Firebase, Omise, Cloud Run, camera or Firestore. No production access.

## Operator procedure
Check out the reviewed V7 commit into a new worktree; verify the exact HEAD. Run:

```bash
gcloud config set project packtook-staging
export RR_STAGING_PROJECT_ID=packtook-staging
python3 -m unittest -v production/scripts/test-rr-v7-handler-semantic-attestation-readonly.py
python3 production/scripts/rr-v7-handler-semantic-attestation-readonly.py --inspect-source
```

The command accesses Staging source archives in memory. If archive access fails, do not expand IAM by default. No secrets, source code, raw exceptions, bucket names, or object paths should be published.

## Interpretation & stop conditions
- `HANDLER_BODY: DIFFERENT`: reviewed export implementation differs; requires human-reviewed scoped diff before proceeding.
- `SHARED_MODULE_SOURCE: DRIFT`: a common helper or another module section differs, even if a single exported handler is identical.
- `CRITICAL_SIGNALS_REMOVED_COUNT`: heuristic only; zero does NOT establish security or behavior parity.
- `DEPLOYED_APP_CHECK_OPTION: ENFORCEMENT_TRUE_LITERAL_IN_OPTIONS`: syntax hint, not proof of runtime App Check enforcement.
- `V7_HANDLER_SEMANTIC_ATTESTATION: REVIEW_REQUIRED`: fail-closed; Gate A and device test remain BLOCKED.
- `STATIC_EVIDENCE_ONLY`: even full static equality does not authorize actual credit/device tests or release.

Next separately approved gate: manual scoped analysis of specific changed handlers/helpers and real deployed enforcement evidence. No deploy or customer credit activity is authorized in V7.
