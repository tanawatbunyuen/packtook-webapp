# P118 — Explicit status callable selector isolation

Offline contract for `packtook-staging`. **NO CLOUD CALLS / NO DEPLOY.**

## Source evidence
- There are 23 known exported Firebase Functions in reviewed `functions/index.js`.
- Only `recordingStatus` and `usageStatus` use `statusOptions` with `enforceAppCheck:true`.
- `firebase.json` uses a single `functions` entry with `codebase: default` and `source: functions`.
- The repository does not contain a verified `.firebaserc`; it is dangerous to infer the target project from implicit CLI defaults.
- This codebase's deployed function ownership/revisions have **not** been verified. An explicit selector is necessary but **insufficient** to prove safe deployment, particularly when functions are unlabeled or have drifted.

## Selector strings for future review only (not executable instructions)

`functions:recordingStatus,functions:usageStatus`

**Do not deploy these selectors now.** Inspect `packtook-staging` inventory, source revisions, codebase metadata, Firebase CLI behavior, service accounts, App Check registration, real staging web site key, monitoring and rollback before any Cloud change.

## CI

```sh
node --check audit/p118-status-selector-isolation.cjs
node audit/p118-status-selector-isolation.cjs
```

CI PASS asserts that `NO_GO_CLOUD_RUNTIME_UNVERIFIED` remains the decision. It does not authorize a deployment or show a Cloud runtime pass.

## Remaining blockers
P117 blockers remain unchanged, including three hosted frontend assets mismatching the reviewed candidate, missing staging site key and lack of backend revision provenance.
