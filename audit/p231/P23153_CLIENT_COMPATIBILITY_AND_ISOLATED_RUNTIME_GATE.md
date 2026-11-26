# P231.53 — accountRole client compatibility and isolated runtime gate

Recorded: 2026-11-26. **Operator-observed** authenticated staging browser request to `accountRole`:
- `Authorization` header PRESENT (value not collected)
- `X-Firebase-AppCheck` header PRESENT (value not collected)
- HTTP 200 (response body not collected)
- The observed call is presumed staging but exact origin/function revision must be correlated with immutable serving revision before independent signoff.

Interpretation: SDK automatic App Check header attachment is compatible with `accountRole` despite its use of `api("accountRole")` rather than `protectedApi("accountRole")`. This is **only a header-presence/network-success check** and does **not** prove server-side App Check enforcement, token validity, or authz correctness.

| callable | browser App Check header | browser Auth header | response | patch static AST |
|---|---|---|---|---|
| usageStatus | OPERATOR_REPORTED_PRESENT | OPERATOR_REPORTED_PRESENT | HTTP 200 baseline | original FALSE, candidate TRUE |
| accountRole | OPERATOR_REPORTED_PRESENT | OPERATOR_REPORTED_PRESENT | HTTP 200 baseline | original FALSE, candidate TRUE |
| recordingStatus | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | original FALSE, candidate TRUE |

Operator's `usageStatus` missing- and malformed-App-Check header tests produced HTTP 200 with preserved Authorization and are consistent with lack of effective App Check enforcement for the current staging deployment; independent full wire-level and correct revision correlation still pending.

## P231.54 next: isolated test specification (NO DEPLOY)

- Do not call `recordingStatus` with fabricated operation IDs, and do not initiate recordings, payments or credit changes just to observe traffic.
- Record checksums of patch and pinned originating build source separately for each function.
- Before any **new** test-function deployment, separately review owner authorization, service-account least privilege, network ingress, invocation controls, synthetic data isolation, App Check valid token issuance, test audit logging, kill switch/cleanup, and rate limits.
- Dedicated read-only test callable should return only a fixed non-sensitive response **after** verified Authentication and App Check; must not use Firebase Admin or Firestore for this test. Enforce `enforceAppCheck:true`; no secrets in source.
- E2E requirements: same endpoint, method, payload, test Firebase Auth and pinned Cloud Run revision; valid legitimate staging App Check token accepted; missing and malformed App Check token rejected, attributed to App Check (not CORS, IAM or Authentication), evidence redacted. No use of `credentials: include` in cross-origin manual fetch.
- Client hosting source release `840e12c0c88d8c1c` has unresolved bridge provenance: `f0f594af1f624f6eb1a12b6b750ce848a9d207f2f78057f3e1ed8ec642521605` not found in tested Git path history. Do not overwrite current Hosting with unverified GitHub files or empty site-key config.
- All deployment and IAM changes, including isolated test-function deployment, remain **out of scope** until separately authorized.

## Decisions

`P231_ACCOUNTROLE_CLIENT_HEADER=PASS_OPERATOR_REPORTED`
`P231_ACCOUNTROLE_EFFECTIVE_ENFORCEMENT=NOT_VERIFIED`
`P231_RECORDINGSTATUS_CLIENT_HEADER=NOT_OBSERVED`
`P231_PATCH_AST=3/3_PASS_OPERATOR_REPORTED`
`P231_ISOLATED_TEST_PLAN=DOCUMENTED_ONLY`
`P231_ISOLATED_TEST_DEPLOY=NOT_PERFORMED`
`P231_PRODUCTION_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
