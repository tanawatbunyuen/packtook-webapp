# Live PACKTOOK Staging Read-only Unauthenticated Security Regression
Date 2026-11-14 (Asia/Bangkok). Read-only real browser test against https://packtook-staging.web.app/.

An independent headless browser starts without any login or credentials, confirms login UI and protected app hidden, and invokes exactly one **read-only** Firebase Callable `accountRole()`. Expected outcome: Firebase unauthenticated/permission-denied or App Check denial. If any data is returned, test fails. Unknown failure codes are not accepted as security proof. No owner credentials, no signup, no payment calls, no writes.

**This does not test Owner's logged-in claims, true App Check token replay, or Omise TEST GET.** Those require isolated authorized session, nonproduction token/secret and controlled evidence. The prior screenshot exposed a password: rotate privately before Owner tests. The deployed App Check bridge differs from the repository version; preserve deployment provenance and do not deploy old source over it.

NO_GO_RELEASE / NO_DEPLOY / PUBLIC CLOSED.
