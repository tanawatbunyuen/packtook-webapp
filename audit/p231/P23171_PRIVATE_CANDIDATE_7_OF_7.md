# P231.71 — Private isolated callable candidate unit tests

Date: 2026-11-26. Operator-supplied Google Cloud Shell output.

- `node --check audit/p231/isolated-test/index.js`: returned successfully in the operator's sequence.
- `node --test audit/p231/isolated-test/test.cjs`: **7 tests, 7 pass, 0 fail**; `P231_UNIT_TEST_EXIT_CODE=0`.
- Tests cover: enforceAppCheck option; `invoker:'private'` and dedicated `p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com`; valid synthetic request fixed response; missing App Check context rejection; missing Firebase Auth rejection; unverified email rejection; unexpected data rejection.
- Earlier existing-services read-only audit: `usagestatus`, `recordingstatus`, `accountrole` each showed 1 direct service-level public invoker binding; invoker IAM disabled annotations not set. **Do not remove existing grants** under this review.
- Runtime Firebase SDK mock tests are not actual Google-issued identity validation, Firebase Auth token validation or App Check cryptographic verification.

`P231_UPDATED_OFFLINE_TESTS=7/7_PASS_OPERATOR_REPORTED`
`P231_PRIVATE_INVOKER_CANDIDATE=STATIC_PASS_OPERATOR_REPORTED`
`P231_RUNTIME_APPCHECK=NOT_VERIFIED`
`P231_DEPLOY=NOT_PERFORMED`
`P231_RELEASE=NO_GO`
`PUBLIC_SIGNUP=KEEP_CLOSED`

Next: inspect exact isolated-source deployment manifest, review packaging reproducibility and separate approvals for creation of a new staging-only function and invoking principal. Merely having an isolated `index.js` on a GitHub review branch does **not** make a deploy-safe Firebase codebase. Never deploy full `functions/` existing SaaS codebase as a shortcut.
