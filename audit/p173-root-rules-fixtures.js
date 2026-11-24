#!/usr/bin/env node
"use strict";
/* P173 exact one-byte candidate and fail-closed policy assertions, offline only. */
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const ROOT=path.join(__dirname,"..");
const rule=fs.readFileSync(path.join(ROOT,"firestore.rules"));
const normalized=fs.readFileSync(path.join(__dirname,"p163-source-rules-normalized.rules"));
const firebase=JSON.parse(fs.readFileSync(path.join(ROOT,"firebase.json"),"utf8"));
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,"p172-release-evidence.json"),"utf8"));
const blob=b=>crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex");
const old="function signedIn(){return request.auth != null}";
const patched="function signedIn(){return request.auth != null;}";
function check(s){
 assert.equal(blob(Buffer.from(s)),"52e207280059e5700da77add9e4af45971c94557","candidate_hash");
 assert.equal(s.split(patched).length,2,"single_patch");
 const reverted=s.replace(patched,old);
 assert.equal(blob(Buffer.from(reverted)),manifest.source_pins["firestore.rules"],"historical_source_pin");
 assert.equal(s,normalized.toString("utf8"),"p163_candidate_equivalence");
 for(const mandatory of [
  "allow write: if false;",
  "allow read: if signedIn() && request.auth.uid == id;",
  "match /accounts/{id}","match /recordings/{rid}","match /audit/{eventId}"
 ])assert(s.includes(mandatory),"required_rule_missing");
 assert.equal((s.match(/allow write: if false;/g)||[]).length,3);
 assert.equal((s.match(/allow read: if signedIn\(\) && request.auth.uid == id;/g)||[]).length,3);
}
check(rule.toString("utf8"));
console.log("P173_ONE_BYTE_SOURCE_PATCH=PASS");
console.log("P173_ROOT_EQUALS_PREVIOUSLY_TESTED_P163_CANDIDATE=PASS");
console.log("P173_CLIENT_WRITES_DENY_ALL_STATIC=PASS");
assert.equal(firebase.firestore.rules,"firestore.rules");
console.log("P173_FIREBASE_CONFIG_REFERENCES_ROOT=PASS");
assert.equal(manifest.decision,"NO_GO_RELEASE");
assert.equal(manifest.deployment,"NO_GO_DEPLOY");
assert.equal(manifest.owner_import,"NO_GO_OWNER_IMPORT");
console.log("P173_P172_HISTORICAL_PIN_AND_NO_GO_PRESERVED=PASS");
const runner=fs.readFileSync(path.join(__dirname,"p173-emulator-root-rules.py"),"utf8");
assert(runner.includes('for k,port in (("auth",19373),("firestore",18373))'));
assert(!runner.includes('("firestore",18373),("hub",14373)'));
console.log("P173_HUB_READINESS_ONLY_REGISTERED_EMULATORS=PASS");
console.log("P173_OFFLINE_FIXTURES=6/6_PASS");
