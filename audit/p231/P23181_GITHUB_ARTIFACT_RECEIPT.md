# P231.81 — GitHub artifact receipt and fresh-clone gate

Recorded 2026-11-26. Operator-supplied push `d3cda54..4a733b9` to `review/p231-appcheck-runtime-readiness`, `P231_PUSH_EXIT_CODE=0`. No Firebase deployment.

Independent GitHub contents API read on the same review branch:
- `audit/p231/isolated-test/package.json`: Git blob SHA `6202fd94e68562c67205bfeb068a1c222b246900`; overrides `@firebase/database:1.1.5`, `@firebase/database-compat:2.1.7`.
- `audit/p231/isolated-test/package-lock.json`: Git blob SHA `980fe485dd1c58512e20a60ccd1cc62b0ea8a1c5`, lockfileVersion=3, 253 package records.
- Operator-reported lockfile SHA256 from P231.79 local workspace: `630f6cb016ad21d99663055ba75c55f103b8a5eadf6ae5528bf658ffbc477c81`.
- GitHub contents API read proves remote file existence and basic shape but is NOT itself SHA256 verification of the exact lockfile bytes. Fresh clone must check exact SHA256 and `npm ci --engine-strict` on Node 22.

No changes to existing SaaS functions, staging invoker, production IAM or public signup are authorized by this record. Separate approval required for creating a staging isolated callable.

`P231_GITHUB_PUSH=PASS_OPERATOR_REPORTED`
`P231_REMOTE_MANIFEST=CONFIRMED`
`P231_REMOTE_LOCKFILE=CONFIRMED`
`P231_REMOTE_SHA256=AWAITING_FRESH_CLONE`
`P231_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`
