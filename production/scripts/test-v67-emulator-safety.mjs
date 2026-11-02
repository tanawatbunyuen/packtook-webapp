// PACKTOOK V6.7 — prove the emulator test cannot run on Production.
// Does not start Firebase, send network calls or connect an emulator.
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const target=new URL("./test-free-auth-firestore-emulator.mjs",import.meta.url);
const runner=fs.readFileSync(new URL("./run-v67-emulators.sh",import.meta.url),"utf8");
const script=fs.readFileSync(target,"utf8");

const clean={...process.env};
for(const k of ["PACKTOOK_QA_DEMO_PROJECT","FIREBASE_AUTH_EMULATOR_HOST","FIRESTORE_EMULATOR_HOST",
 "GCLOUD_PROJECT","GCP_PROJECT","GOOGLE_CLOUD_PROJECT","FIREBASE_PROJECT_ID"])delete clean[k];
function rejected(label,env){
 const result=spawnSync(process.execPath,[new URL(target).pathname],{
  env:{...clean,...env},encoding:"utf8",timeout:5000
 });
 assert.notEqual(result.status,0,label+" must not succeed");
 assert.match(result.stderr,/SAFETY BLOCK:/,label+" must fail before requiring SDK/network");
 console.log("PASS: "+label+" fails closed");
}
rejected("no emulator configuration",{});
rejected("fake marker without emulator hosts",{PACKTOOK_QA_DEMO_PROJECT:"demo-packtook-v67"});
rejected("emulator hosts without demo opt-in",{
 FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",
 FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080"
});
rejected("live production project id even if emulators supplied",{
 PACKTOOK_QA_DEMO_PROJECT:"demo-packtook-v67",
 FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080",
 GCLOUD_PROJECT:"packtook-prod-01"
});
rejected("external emulator host",{
 PACKTOOK_QA_DEMO_PROJECT:"demo-packtook-v67",
 FIREBASE_AUTH_EMULATOR_HOST:"example.com:9099",FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080"
});
assert(script.includes("admin.initializeApp({projectId:DEMO})"));
// Main-realm compilation avoids Firestore's cross-realm custom-prototype error.
assert(script.includes('new Function("exports","process","require","console",source)'));
assert(!script.includes("vm.runInNewContext(source"));
assert(script.includes("V6.7 EMULATOR INTEGRATION FAILED at stage:"));
assert(script.includes('admin.app().options.projectId!==DEMO'));
assert(script.includes('onCall(options,handler)'));
assert(script.includes('enforceAppCheck:true'));
assert(runner.includes('firebase emulators:exec'));
assert(runner.includes('--project "$DEMO"'));
assert(runner.includes('--only auth,firestore'));
assert(!runner.includes("firebase deploy"));
console.log("RESULT: PACKTOOK V6.7 emulator isolation and fail-closed protection PASS.");
