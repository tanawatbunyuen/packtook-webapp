# P231.76 — Node.js 22 dependency engine compatibility gate

Date: 2026-11-26. Operator-provided Cloud Shell output (not independently executed).

PASS: official Node 22.23.5 archive checksum, npm 10.9.9, `npm ci`, 7/7 mocked unit tests, static preflight 10/10, package-lock version 3, 253 packages, SHA256 `75efb65b806b755c069421e6e648659cd83bb5a4919f0b4a5671fdd4e04a6833`.

**Open blocker**: npm `EBADENGINE`:
- `@firebase/database@1.1.6` requires `node >=24.12.0`.
- `@firebase/database-compat@2.1.8` requires `node >=24.12.0`.
- Runtime targeted by isolated callable is Node 22.

Installing successfully without `engine-strict` does not prove supported runtime. Do not commit this lockfile as a deployment-approved artifact; do not deploy. Analyze dependency tree, verify Node 22-compatible versions by querying registry metadata, and then regenerate lockfile using reviewed root overrides or another compatible dependency graph. Run `npm ci --engine-strict` and re-run all offline tests on Node 22, then re-hash and review full dependency graph. Version hints `@firebase/database@1.1.5` and `@firebase/database-compat@2.1.7` must be verified from registry and tree, not assumed.

Npm docs: https://docs.npmjs.com/cli/v10/configuring-npm/package-json ; https://docs.npmjs.com/cli/v11/configuring-npm/package-json/ .

`P231_NODE22_OFFLINE=7/7_PASS_OPERATOR_REPORTED`
`P231_STATIC_PREFLIGHT=10/10_PASS_OPERATOR_REPORTED`
`P231_LOCKFILE_SHA256=75efb65b806b755c069421e6e648659cd83bb5a4919f0b4a5671fdd4e04a6833`
`P231_NODE22_TRANSITIVE_ENGINES=FAIL`
`P231_PACKAGE_RELEASE_GATE=BLOCKED`
`P231_ISOLATED_DEPLOY=NOT_PERFORMED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_RELEASE=NO_GO`
