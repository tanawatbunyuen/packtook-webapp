# P231.85 — Isolated deploy artifact preview / no deploy

Date: 2026-11-26. Operator reports one active Cloud Shell account, staging project readable, P231 function not visible, and P231.84 read-only identity gate exit 0. This does not establish deployment privileges.

The deployment preview script whitelists only `index.js`, `package.json`, and `package-lock.json` from the verified P231 isolated candidate. It generates a separate temporary `firebase.json` with exactly one `functions` entry, `source: p231-function` and `codebase: p231-isolated`. It does not call Firebase CLI or any Cloud API, does not deploy, and does not write IAM. The temp directory must be reviewed and cleaned up by operator when appropriate. It intentionally leaves that directory visible for review.

Firebase documents multiple codebases to prevent deploy-time cleanup prompts for functions outside the repo: https://firebase.google.com/docs/functions/organize-functions. This reduces risk but is **not** a substitute for scope validation and exact Firebase CLI deploy-filter verification. Do not deploy from the existing root project firebase.json or use broad --only functions.

Source configuration includes `invoker:'private'`, `serviceAccount:'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com'`, and `enforceAppCheck:true`. The isolated runtime account is operator-confirmed created with verifier IAM role. Test principal, IAM invoker grant and cleanup plan remain unapproved.

Required before staging deployment: separately authorize **exact new function only**, review who receives scoped invoker, confirm the deployer can actAs the dedicated runtime account and necessary APIs/billing, pre-review immutable artifact, verify source does not touch customer data, and document cleanup strategy. Verify CLI filter semantics via pinned CLI; do not assume its flag syntax. Three-way App Check runtime verification remains outstanding.

`P231_OPERATOR_IDENTITY_PREFLIGHT=PASS_OPERATOR_REPORTED`
`P231_DEPLOY_PACKAGE_PREVIEW=NOT_YET_RUN`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`
