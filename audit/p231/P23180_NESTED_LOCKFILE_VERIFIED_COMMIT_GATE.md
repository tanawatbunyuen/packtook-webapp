# P231.80 — Isolated package lockfile verified; commit gate

Date: 2026-11-26. Evidence below comes from operator-supplied Google Cloud Shell output, not independent cloud access.

## Confirmed checks
- Node: `v22.23.5`.
- `P231_VERSION_PIN=PASS`, exit code 0.
- `@firebase/database@1.1.5` pinned at `node_modules/firebase-admin/node_modules/@firebase/database`.
- `@firebase/database-compat@2.1.7` pinned at `node_modules/firebase-admin/node_modules/@firebase/database-compat`.
- `P231_OVERRIDE__FIREBASE_DATABASE=PASS`, `P231_OVERRIDE__FIREBASE_DATABASE_COMPAT=PASS`.
- Lockfile version 3, packages 253, SHA256 `630f6cb016ad21d99663055ba75c55f103b8a5eadf6ae5528bf658ffbc477c81`.
- Previous operator run P231.78: `npm ci --engine-strict` PASS, 7/7 mocked unit tests PASS, 10/10 static checks PASS; original P231.78 script ended nonzero because it incorrectly assumed top-level lockfile paths; P231.79 corrects this read-only check.
- `P231_GITHUB_WRITES=0`, `P231_CLOUD_WRITES=0`, `P231_DEPLOY=NOT_PERFORMED`.

## Commit-only next action
The canonical package manifest and lockfile currently exist in the operator's Cloud Shell checkout, **not yet in GitHub**. Do not synthesize/reconstruct a package-lock file from the digest. Stage **only** `audit/p231/isolated-test/package.json` and `audit/p231/isolated-test/package-lock.json`. Verify expected hash, `git diff --cached --name-only`, and branch before committing. Do not force push, deploy, edit IAM, or alter existing functions. Require operator confirmation that the exact staged files match expected scope.

## Future gates
After commit: verify SHA256 from fresh Git clone, actual Firebase v2 callable export and independent deployment-package lint on Node 22, explicit approval and risk review for any staging deploy and private invoker principal. Keep production and public signup unchanged.

`P231_NODE22_STRICT_INSTALL=PASS_OPERATOR_REPORTED`
`P231_NESTED_VERSION_PIN=PASS_OPERATOR_REPORTED`
`P231_LOCKFILE_GITHUB=NOT_YET_COMMITTED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
