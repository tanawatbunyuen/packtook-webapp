// PACKTOOK V6.7 — require BOTH emulators before launching demo QA.
// Read-only local file validation; no Firebase requests or live credentials.
import assert from "node:assert/strict";
import fs from "node:fs";

const local=JSON.parse(fs.readFileSync(new URL("../firebase.emulators-v67.json",import.meta.url),"utf8"));
const production=JSON.parse(fs.readFileSync(new URL("../firebase.json",import.meta.url),"utf8"));
const script=fs.readFileSync(new URL("./run-v67-emulators.sh",import.meta.url),"utf8");

assert.equal(local.firestore?.rules,"firestore.rules");
assert.equal(local.firestore?.indexes,"firestore.indexes.json");
assert.equal(local.emulators?.auth?.host,"127.0.0.1");
assert.equal(local.emulators?.auth?.port,9099);
assert.equal(local.emulators?.firestore?.host,"127.0.0.1");
assert.equal(local.emulators?.firestore?.port,8080);
for(const component of ["hub","logging"]){
 assert.equal(local.emulators?.[component]?.host,"127.0.0.1",
  component+" must avoid IPv6 ::1 on Cloud Shell");
}
assert.equal(local.emulators?.ui?.enabled,false);
assert.equal(local.hosting,undefined,"Demo config must not have Production Hosting");
assert.equal(local.functions,undefined,"Demo config must not configure Production Functions");
assert.equal(production.emulators,undefined,
 "Production firebase.json must remain unchanged; emulator settings are isolated");
assert(script.includes('--config firebase.emulators-v67.json'),
 "Runner must load the separate Auth+Firestore emulator configuration");
assert(script.includes('--only auth,firestore'),
 "Runner must start BOTH Auth and Firestore");
assert(script.includes('--project "$DEMO"'),
 "Runner must pin demo-packtook-v67 instead of relying on active CLI project");
assert(!script.includes("--config firebase.json --only auth,firestore"),
 "Old Firestore-only default config must not be reused");
assert(!script.includes("firebase deploy"),"Demo runner must not deploy live resources");
console.log("PASS: explicit Auth 127.0.0.1:9099 + Firestore 127.0.0.1:8080 configured");
console.log("PASS: IPv4-only Emulator Hub/Logging and dedicated no-deploy config");
console.log("PASS: Production firebase.json remains isolated; DEMO project pinned");
console.log("RESULT: V6.7 Emulator configuration regression PASS.");
