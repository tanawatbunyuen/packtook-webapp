# P231.91 — Firebase CLI filtered deploy syntax and mandatory HOLD

Date: 2026-11-26. Operator-reported CLI 15.34.2 and P231.90 local read-only audit:
- `P231_FIREBASE_ONLY_FILTER=SUPPORTED`
- `P231_FUNCTION_EXPORT_COUNT=1`
- `P231_ISOLATED_CODEBASE=PASS`
- `P231_SOURCE_WHITELIST=PASS`
- proposed selector `functions:p231-isolated:p231AppCheckIsolatedProbe`
- `P231_CLI_GATE_EXIT_CODE=0`

Upstream `firebase-tools` deploy CLI help in GitHub source explicitly supports `functions:<codebase>:<func>` filter. This is evidence for selector syntax, though not independent inspection of local 15.34.2 implementation:
https://github.com/firebase/firebase-tools/blob/main/src/commands/deploy.ts

**Do not run `firebase deploy --dry-run` as if it were guaranteed read-only.** The source/help warns it can still enable target project APIs. Do not run a real deploy, a force deploy, or any blanket functions deploy. To verify the installed CLI help use `firebase deploy --help` only.

The current package preview is locally generated and source-scoped, not a deployed function. Before any deploy:
- identify the exact principal for service-level invoker grant; do not infer from deployer's identity or print personal account details; inspect scope of its permissions.
- establish timebox, owner, budget/log monitoring and precise rollback/cleanup limited to new service; require separate approval for cleanup execution.
- verify new-only deploy from isolated config path, Cloud Run private IAM after creation and before invocation; abort if public.
- no Production, existing functions, Hosting, signup, Firestore or payments may be changed.

P231_DEPLOY_SELECTOR_SYNTAX=SUPPORTED_BY_UPSTREAM_DOCS
P231_LOCAL_CLI_SPECIFIC_FILTER_IMPLEMENTATION=NOT_INDEPENDENTLY_VERIFIED
P231_PRIVATE_INVOKER_PRINCIPAL=NOT_SELECTED
P231_CLEANUP_TIMEBOX=NOT_APPROVED
P231_FUNCTION_DEPLOY=NOT_PERFORMED
P231_RUNTIME_APPCHECK=NOT_VERIFIED
P231_RELEASE=NO_GO
PUBLIC_SIGNUP=KEEP_CLOSED
