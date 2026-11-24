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
assert(runner.includes("P173_EMULATOR_EXIT_CATEGORY="));
assert(runner.includes("diagnose_exit(log)"));
assert(runner.includes("UNCLASSIFIED_REVIEW_PRIVATE_LOG"));
console.log("P173_EMULATOR_EXIT_SAFE_DIAGNOSTIC_FIXTURE=PASS");
assert(runner.includes('"HOME":str(Path.home())'));
assert(runner.includes("P173_CLI_HOME_PARITY_WITH_P171=PASS"));
console.log("P173_CLI_HOME_PARITY_FIXTURE=PASS");
assert(runner.includes('settings["firestore"]={"rules":"firestore.rules"}'));
assert(runner.includes("P173_CONFIG_NEXT_TO_ROOT_RULES=PASS"));
assert(runner.includes('config_path.unlink(missing_ok=True)'));
assert(runner.includes('"--config",str(config_path)'));
console.log("P173_ROOT_ADJACENT_TEMP_CONFIG_FIXTURE=PASS");
assert(runner.includes('P173_HUB_"+kind.upper()+"_REGISTERED='));
assert(runner.includes('P173_HUB_"+kind.upper()+"_PORT='));
assert(runner.includes('type(port) is int and 1<=port<=65535'));
console.log("P173_HUB_AUTH_REGISTRATION_DIAGNOSTIC_FIXTURE=PASS");
assert(runner.includes('P173_TEMP_CONFIG_AUTH_PORT=19373'));
assert(runner.includes('P173_AUTH_STARTUP_CATEGORY='));
assert(runner.includes('P173_AUTH_CONFIGURED_PORT_TCP_OPEN='));
assert(runner.includes('def auth_startup_category(log_path):'));
assert(runner.includes('def auth_endpoint_probe():'));
assert(runner.includes('AUTH_NOT_MENTIONED'));
console.log("P173_AUTH_BOOTSTRAP_DIAGNOSTICS_FIXTURE=PASS");
const authProbe=fs.readFileSync(path.join(__dirname,"p173-auth-only-differential.py"),"utf8");
assert(authProbe.includes('"--only","auth"'));
assert(authProbe.includes('"auth":{"host":"127.0.0.1","port":AUTH}'));
assert(!authProbe.includes('"--only","auth,firestore"'));
assert(authProbe.includes("P173_AUTH_ONLY_EMULATOR_STOPPED=TRUE"));
assert(authProbe.includes("P173_AUTH_ONLY_TEMP_CONFIG_REMOVED=TRUE"));
assert(authProbe.includes("P173_AUTH_ONLY_CLOUD_CALLS=0 P173_AUTH_ONLY_DEPLOYS=0"));
console.log("P173_AUTH_ONLY_DIFFERENTIAL_SAFETY_FIXTURE=PASS");
assert(runner.includes('if allowed!={"auth","firestore"}:'));
assert(runner.includes('P173_LAUNCH_CONFIGURED_SERVICES=AUTH_AND_FIRESTORE'));
assert(runner.includes('P173_LAUNCH_ONLY_FILTER=OMITTED'));
assert(!runner.includes('"--only","auth,firestore"'));
console.log("P173_DUAL_SERVICE_FILTER_DIFFERENTIAL_FIXTURE=PASS");
console.log("P173_OFFLINE_FIXTURES=13/13_PASS");
