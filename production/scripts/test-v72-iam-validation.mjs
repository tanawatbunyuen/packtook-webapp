// PACKTOOK V7.2 IAM validation: OFFLINE SOURCE-ONLY; NO CLOUD WRITES.
import assert from "node:assert/strict";
import fs from "node:fs";
const s=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const names=["publicSignupStatus","completeFreeSignup","pilotInvitationStatus","completePilotFreeSignup"];
const sa="packtook-public-pilot-v72@packtook-prod-01.iam.gserviceaccount.com";
const required=["datastore.databases.get","datastore.entities.get","datastore.entities.create","datastore.entities.update","firebaseauth.users.get","firebaseauth.users.update"];
const forbidden=["datastore.entities.delete","firebaseauth.users.delete","firebaseauth.users.create","firebaseauth.configs.update","firebaseauth.configs.getSecret"];
function evaluate(p){const a=new Set(p);return {missing:required.filter(x=>!a.has(x)),forbidden:forbidden.filter(x=>a.has(x))}}
assert.deepEqual(evaluate(required),{missing:[],forbidden:[]});
for(const x of required)assert(evaluate(required.filter(p=>p!==x)).missing.includes(x));
for(const x of forbidden)assert(evaluate([...required,x]).forbidden.includes(x));
console.log("PASS: six proposed permissions, negative cases for omission and overgrant");
assert(s.includes('const PUBLIC_PILOT_RUNTIME_SA="'+sa+'"'));
assert(s.includes('defineSecret("PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX")'));
assert(s.includes("PUBLIC_FREE_EMAIL_HMAC_SECRET.value()"));
assert(!s.includes("process.env.PACKTOOK_PUBLIC_FREE_EMAIL_HMAC_KEY_HEX"));
assert(s.includes("const options={region,maxInstances:5,timeoutSeconds:30};"));
assert.equal((s.match(/serviceAccount:PUBLIC_PILOT_RUNTIME_SA/g)||[]).length,4);
function section(name){const start=s.indexOf("exports."+name+"=onCall(");assert(start>=0,"Missing "+name);const end=s.indexOf("\nexports.",start+1);return s.slice(start,end<0?s.length:end)}
const f=Object.fromEntries(names.map(n=>[n,section(n)]));
for(const [n,v] of Object.entries(f)){
 const header=v.slice(0,v.indexOf("},async")+7);
 assert(header.includes("serviceAccount:PUBLIC_PILOT_RUNTIME_SA"),n+" runtime");
 assert(header.includes("secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]"),n+" secret");
 if(n!=="publicSignupStatus")assert(header.includes("enforceAppCheck:true"),n+" App Check");
}
console.log("PASS: exactly four dedicated SA/Secret bindings and three App Check guards");
assert(!/admin\.auth\(\)|db\.runTransaction|db\.collection\(/.test(f.publicSignupStatus));
for(const x of ["admin.auth().getUser(id)","admin.auth().setCustomUserClaims(id,","db.runTransaction(async tx=>","tx.create(emailIndex,","tx.create(ref,","tx.update(shortRef,"])assert(f.completeFreeSignup.includes(x),x);
for(const x of ["requirePilotLease(req,","own(req.auth.uid).get()"])assert(f.pilotInvitationStatus.includes(x),x);
for(const x of ["requirePilotLease(req)","tx.get(PILOT_V72_CONTROL)","db.runTransaction(async tx=>","admin.auth().setCustomUserClaims(id,"])assert(f.completePilotFreeSignup.includes(x),x);
assert(s.includes('const PILOT_V72_CONTROL=db.collection("pilotControls").doc("v72")'));
assert(s.includes('db.collection("publicSignupGuards")'));
assert(s.includes('db.collection("accounts")'));
console.log("PASS: Firebase Auth get/update and Firestore transaction dependencies");
console.log(JSON.stringify({mode:"OFFLINE_SOURCE_ONLY",designChecksPassed:true,customRoleSupportVerified:false,effectiveIamVerified:false,emulatorIntegrationVerified:false,productionWrites:false,readyForPilot:false,decision:"NO_GO_CONTROLLED_PILOT",proposedPermissions:required},null,2));
