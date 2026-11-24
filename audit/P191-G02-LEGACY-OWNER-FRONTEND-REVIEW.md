# P191 — G02 Legacy Owner Frontend Compatibility Guard

**NO_GO_G02 / NO_GO_RELEASE / NO_GO_DEPLOY.**

## Root finding
The production web app's `production/app/app.js` previously displayed the role from `accountRole` but, after a permission-denied response for a legacy account lacking `ownerUid`, only emitted a generic transient toast. The role label was not reset between sign-ins and an in-flight response from the prior user could overwrite the currently signed-in user's displayed role.

## Review-branch code change
- Adds a deterministic `roleDisplay(info,error)` helper with a clear Thai message for denied account-owner verification, without falsely claiming the user is Admin/Operator.
- Resets `accountRoleInfo` and the visible label at every auth-state change and on logout.
- Rejects stale asynchronous role success/failure if the current user's UID differs from the identity used to request the role.
- Keeps existing packing, credit reservation, duplicate-approval and device logic unchanged.
- This is a **real code change to `production/app/app.js` in a draft review branch only**. No hosting deployment occurred. It is not approved for deploy until independently reviewed.

## Remaining G02 external dependencies
Operator-scoped real staging/production legacy account inventory (P186), valid staging App Check acceptance (P187), independent historical owner provenance, and the signed P188 backend candidate/security review. Fixing the UI does not grant legacy owners and does not make denied admin functions usable; it only prevents misleading role presentation and outdated UI state. Human remediation of legacy users remains required.

## CI limitations
Node source parsing and pure helper/static source assertions are not a full browser E2E or a test against live Firebase. Keep G02 NO_GO and all eight production release gates blocked.
