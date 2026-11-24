#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const {verify,record}=require("./p172-release-gates.js");
const clone=()=>JSON.parse(JSON.stringify(record));
assert(verify());
console.log("P172_FIXTURE_BASE_GATES=PASS");
let v=clone();v.decision="GO";assert.throws(()=>verify(v));
console.log("P172_FIXTURE_REJECT_RELEASE_GO=PASS");
v=clone();v.gates[0].status="PASS";assert.throws(()=>verify(v));
console.log("P172_FIXTURE_REJECT_GATE_CLEARED_WITHOUT_REVIEW=PASS");
v=clone();v.evidence[3].runtime_attested=true;assert.throws(()=>verify(v));
console.log("P172_FIXTURE_REJECT_FAKE_RUNTIME_ATTESTATION=PASS");
v=clone();v.evidence[3].result="18/18 PASS";assert.throws(()=>verify(v));
console.log("P172_FIXTURE_REJECT_ERASED_PROTOCOL_GAP=PASS");
v=clone();v.evidence[6].result="signed Firebase token production verified";assert.throws(()=>verify(v));
console.log("P172_FIXTURE_REJECT_EMULATOR_SIGNATURE_OVERCLAIM=PASS");
console.log("P172_OFFLINE_FIXTURES=6/6_PASS");
