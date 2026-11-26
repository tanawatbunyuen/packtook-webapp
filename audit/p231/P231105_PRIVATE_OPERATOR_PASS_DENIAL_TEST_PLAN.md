# P231.105 — Private operator direct IAM PASS; anonymous denial test next

Date: 2026-11-26. Operator-supplied P231.104 verification:
- `P231_FUNCTION_RUNTIME_SA=MATCH`
- `P231_IAM_CHECK=NOT_DISABLED_IN_SERVICE_METADATA`
- `P231_SERVICE_DIRECT_PUBLIC_MEMBER_COUNT=0`
- `P231_ACTIVE_OPERATOR_INVOKER_BINDING_COUNT=1`
- `P231_POST_GRANT_VERIFICATION=DIRECT_POLICY_PASS`
- `P231104_VERIFY_EXIT_CODE=0`
- `P231_EFFECTIVE_HTTP_DENIAL=NOT_TESTED`
- `P231_IAM_WRITES=0`, `P231_E2E_INVOCATION=NOT_PERFORMED`
- `P231_RUNTIME_APPCHECK=NOT_VERIFIED`, `P231_RELEASE=NO_GO`

This evidence confirms direct Cloud Run service IAM configuration after the P231.103 operator grant, not effective rejection of uncredentialed HTTP requests or App Check enforcement.

## P231.105 controlled negative IAM test

User previously approved P231.94 staging-only testing on 2026-11-26, private invoker only for current operator, and separate cleanup approval. New script `p231105-unauthenticated-iam-denial-test.sh` makes **one** anonymous POST to the new Cloud Run service, only after verifying staging project, current test date, exact function runtime SA, invoker IAM not disabled in service metadata, zero direct public bindings, and a provider-returned Cloud Run `https://...run.app` address. The request includes only a constant empty callable payload. **No Google ID Token, Firebase Auth ID Token or App Check token** is sent; no endpoint URL, principal, response body or token values are printed.

A resulting HTTP 401/403 is evidence that the request was rejected, but is not necessarily sufficient by itself to attribute the rejection exclusively to the Cloud Run IAM layer (a callable handler could also return HTTP 401). Unexpected 200 or 400 or 404, or transport errors, are HOLD for investigation. This does not replace scoped effective IAM and App Check VALID/MISSING/MALFORMED tests.

No IAM change, deployment, cleanup, Production or Public Signup change is authorized/executed by this script. Cleanup still needs separate approval. Date lock stops tests after 2026-11-26 Asia/Bangkok.

P231_DIRECT_OPERATOR_IAM=PASS_OPERATOR_REPORTED
P231_ANONYMOUS_DENIAL=AWAITING_HTTP_TEST
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_CLEANUP=NOT_AUTHORIZED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
