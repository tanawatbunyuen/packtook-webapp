"use strict";
/** Fail-closed static drift guard against the observed 2026-11-28 finalize ReferenceError. */
const fs=require("node:fs"),assert=require("node:assert/strict");
const s=fs.readFileSync("functions/tenant-credit-atomic-v1.cjs","utf8");
assert.match(s,/const a=aSnap\.exists\?aSnap\.data\(\):null,record=rSnap\.exists\?rSnap\.data\(\):null;/);
assert.match(s,/assertFinalization\(ctx,membership\(ctx,mSnap\),verifiedEmail,\{\s*accountOwnerUid:ctx\.accountId,recording:record,operationId\}/);
assert.doesNotMatch(s,/accountOwnerUid:ctx\.accountId,recording,operationId\}/);
console.log("PACKTOOK_ATOMIC_FINALIZE_UNDEFINED_RECORDING_REGRESSION=PASS");
console.log("PACKTOOK_ATOMIC_EMULATOR=NOT_EXECUTED");
console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
