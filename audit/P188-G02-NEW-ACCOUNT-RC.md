# P188 — G02 Single Release-Candidate Source and New Customer Compatibility

**Review-only. NO_GO_G02 / NO_GO_RELEASE / NO_GO_DEPLOY / NO_GO_OWNER_IMPORT.**

## New risk found
The prior P183/P184 G02 guard candidate requires a persisted `ownerUid` for `accountRole` and duplicate authorization. But the original backend `ensureAccount(id)` creates new Free accounts **without** `ownerUid`, making every newly onboarded customer unable to obtain Admin status under the stricter policy.

## Corrected release candidate
`audit/p188/build-rc.js` generates an isolated copy of the **entire** backend from the SHA-pinned original + four guarded P183 edits, one P184 supported Firebase Admin `FieldValue` import fix, and one new-account-only provision change:
```js
ref.create({ownerUid:id,plan:"Free",period:periodId(Date.now()),used:0,reserved:0,createdAt:FieldValue.serverTimestamp()})
```
This is a create-only transaction issued in authenticated customer flow; it cannot retroactively claim an existing legacy account because `create` fails when the document exists. The `already-exists` case preserves the previous document. There is no migration, no automatic ownerUid backfill, and no Owner-platform functions imported.

P188 runs real Callable HTTP for the existing P184 14 scenarios plus new-account creation, immediate admin role availability, idempotent repeated status and legacy no-backfill cases under **local** Auth + Functions + Firestore Emulator.

**Important:** The original `functions/index.js` remains unchanged. The generated artifact resides under `audit/p188/` during CI, and only a disposable emulator copy is executed. This is *not* a reviewed production deployable source until code ownership approves the exact diff.

## Remaining G02 blockers
1. Production/Staging authorized **read-only** existing-account inventory via P186 with independent verification of missing ownerUid and ownership conflicts. No actual live project was examined by CI.
2. Valid App Check token accepted on actual staging `usageStatus`, missing token denied, recorded against exact validated endpoint and revision. P187 has mocked test only.
3. Source and SDK pin review including `FieldValue`, actual staging Auth/Callable/Firestore regression, legacy remediation and independent security signoff.
4. P168 invalid token protocol and production Firebase token cryptographic signature remain separate G03/G04 gates.

Review only; do not merge or deploy; Production release gates 0/8.
