# P231.104 — IAM grant may have succeeded; verification failed due to jq syntax

2026-11-26 operator-supplied output:
- P231_CHECK=NEW_SERVICE_ACTIVE_OPERATOR_INVOKER
- P231_DIRECT_PRIVATE_IAM=PASS
- P231_INVOKER_TARGET=NEW_SERVICE_ONLY
- `Updated IAM policy for service [p231appcheckisolatedprobe].`
- jq error: unexpected end of file, expected closing syntax
- P231_SERVICE_INVOKER_GRANT=UNVERIFIED
- P231103_GRANT_EXIT_CODE=2

**Do not repeat the grant.** The policy write likely completed before the local verification failed; treat IAM state as UNKNOWN until read-only verification.

Fixed incorrect jq conditional in `p23194-grant-active-operator-invoker.sh`, but DO NOT run that script in apply mode again. Added dedicated `p231104-verify-operator-invoker-readonly.sh` which checks identity of new Function and its runtime SA, IAM check setting, the active operator's unconditional binding to `roles/run.invoker`, and absence of any direct public IAM member on the one new Cloud Run Service. It never changes IAM, deploys, invokes or performs cleanup. Output contains no operator email/token.

Read-only results must be reviewed before any further action. Even if the direct policy passes, actual unauthenticated denial and App Check runtime remain unverified. The user's approval to deploy staging P231.94 was same-day; cleanup needs separate approval. Production remains NO-GO and Public Signup closed.

P231_POST_GRANT_EFFECTIVE_IAM=AWAITING_READ_ONLY_RESULT
P231_IAM_WRITE_ALREADY_REPORTED=YES
P231_REAPPLY_GRANT=DO_NOT_REPEAT
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
