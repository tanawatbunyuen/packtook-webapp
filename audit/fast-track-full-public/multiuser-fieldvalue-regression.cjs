"use strict";
/** Regression gate for Functions Emulator worker missing FieldValue. No cloud I/O. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const source=fs.readFileSync("functions/index.js","utf8");
assert.match(source,/const \{FieldValue\}=require\("firebase-admin\/firestore"\)/);
assert.doesNotMatch(source,/const \{FieldValue\}=admin\.firestore/);
assert.match(source,/typeof FieldValue\.serverTimestamp!=="function"/);
assert.match(source,/typeof FieldValue\.increment!=="function"/);
const sdk=require("./../../functions/node_modules/firebase-admin/firestore");
assert.equal(typeof sdk.FieldValue.serverTimestamp,"function");
assert.equal(typeof sdk.FieldValue.increment,"function");
console.log("PACKTOOK_FIELDVALUE_MODULAR_IMPORT_REGRESSION=PASS");
console.log("PACKTOOK_FIELDVALUE_RUNTIME_FUNCTIONS=2/2_PRESENT");
console.log("PACKTOOK_FUNCTIONS_EMULATOR_WORKER=NOT_YET_RETESTED");
console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
