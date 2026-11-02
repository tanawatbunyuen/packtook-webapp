// PACKTOOK V7.0 — no Firebase/network: negative/positive guard regressions.
import assert from "node:assert/strict";
import {assertV70DemoEnvironment as check} from "./v70-emulator-guard.mjs";
const ok={PACKTOOK_QA_DEMO_PROJECT:"demo-packtook-v70",
 FIREBASE_AUTH_EMULATOR_HOST:"127.0.0.1:9099",
 FIRESTORE_EMULATOR_HOST:"127.0.0.1:8080"};
for(const host of ["127.0.0.1","localhost","[::1]"]){
 assert.equal(check({...ok,FIREBASE_AUTH_EMULATOR_HOST:host+":9099",FIRESTORE_EMULATOR_HOST:host+":8080"}),true);
}
console.log("PASS: exact-port IPv4, localhost and IPv6 loopback endpoints accepted");
const reject=(env,tag)=>assert.throws(()=>check(env),e=>e.message.includes("SAFETY BLOCK ["+tag+"]"));
reject({...ok,PACKTOOK_QA_DEMO_PROJECT:"packtook-prod-01"},"DEMO_PROJECT");
reject({...ok,PACKTOOK_QA_DEMO_PROJECT:undefined},"DEMO_PROJECT");
for(const value of ["0.0.0.0:9099","192.168.1.1:9099","[::]:9099","127.0.0.1:9098","127.0.0.1:9099x"]){
 reject({...ok,FIREBASE_AUTH_EMULATOR_HOST:value},"AUTH_EMULATOR_HOST");
}
for(const value of ["0.0.0.0:8080","10.0.0.5:8080","[::]:8080","127.0.0.1:8081","127.0.0.1:8080x"]){
 reject({...ok,FIRESTORE_EMULATOR_HOST:value},"FIRESTORE_EMULATOR_HOST");
}
for(const key of ["GCLOUD_PROJECT","GCP_PROJECT","GOOGLE_CLOUD_PROJECT","FIREBASE_PROJECT_ID"]){
 reject({...ok,[key]:"packtook-prod-01"},key);
}
console.log("PASS: non-demo, non-loopback, wrong ports and Production project contexts blocked");
console.log("RESULT: PACKTOOK V7.0 EMULATOR GUARD REGRESSION PASS (offline only)");
