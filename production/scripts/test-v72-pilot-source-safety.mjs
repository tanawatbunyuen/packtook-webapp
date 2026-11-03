// V7.2 fail-closed inspection of server-side Pilot code. No cloud access.
import assert from "node:assert/strict";
import fs from "node:fs";
import {inspectPilotSource,PILOT_PROTECTED_CALLABLES} from "./v72-pilot-source-check.mjs";
const backend=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const check=src=>inspectPilotSource(src);
const good=check(backend);
assert.equal(good.sourcePass,true,JSON.stringify(good.checks));
assert.equal(good.assessedProtectedCallableCount,12);
assert.equal(PILOT_PROTECTED_CALLABLES.length,12);
const tamper=(old,replacement,expected)=>{
 assert(backend.includes(old),"Missing test mutation anchor "+old);
 const r=check(backend.replace(old,replacement));
 assert.equal(r.sourcePass,false,"Tampered pilot source must fail closed");
 assert.equal(r.checks[expected],false,"Expected exact failed check "+expected);
};
tamper('process.env.PACKTOOK_V72_PILOT_ENABLED==="true"',
 'process.env.PACKTOOK_V72_PILOT_ENABLED!=="false"',
 "explicitDefaultOff");
tamper('!V7_QA_ENABLED&&publicCustomerAppReady()',
 'publicCustomerAppReady()',
 "explicitPublicQaOff");
tamper('exports.completePilotFreeSignup=onCall({...options,enforceAppCheck:true',
 'exports.completePilotFreeSignup=onCall({...options,enforceAppCheck:false',
 "exactSignedAppCheck");
tamper('V72_PILOT_MAX_MS=4*60*60*1000',
 'V72_PILOT_MAX_MS=48*60*60*1000',
 "leaseFourHours");
tamper('c.invitedUids.includes(req.auth.uid)',
 'Boolean(req.auth?.uid)',
 "activeServerSideUidAllowlist");
tamper('tx.get(PILOT_V72_CONTROL)',
 'Promise.resolve({exists:true,data:()=>({enabled:true})})',
 "firestoreRuntimeKillSwitch");
tamper('PILOT_VALIDATED_REQUESTS.add(req);',
 '/* omitted live-lease attestation */',
 "onEveryProtectedRequest");
tamper('PILOT_VALIDATED_REQUESTS.has(req)',
 'true',
 "onEveryProtectedRequest");
tamper('exports.reserveCredit=guardedCall(options,async req=>{',
 'exports.reserveCredit=onCall(options,async req=>{',
 "onEveryProtectedRequest");
tamper('guard.doc("email_v1_"+publicEmailKey(live.email))',
 'guard.doc("unchecked_email")',
 "safeGrantTransaction");
assert.equal(good.checks.noClientFirestoreAccess,true);
assert.equal(good.checks.noEmbeddedPilotIdentifiers,true);
console.log("PASS: Pilot source defaults OFF, requires 3 Public flags + QA OFF, real attested Customer App ID");
console.log("PASS: <=3 invited UIDs, <=4h UTC lease, session nonce, live Auth eligibility and consent");
console.log("PASS: all 12 credit/device/recording/status callables check live revocable Pilot lease");
console.log("PASS: unsafe source mutations fail closed; grant HMAC lock/caps and Firestore transactional controls");
console.log("RESULT: PACKTOOK V7.2 PILOT SOURCE SAFETY PASS (offline, no cloud writes)");
