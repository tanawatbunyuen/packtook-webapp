// PACKTOOK V7.1 — offline read-only readiness and DEMO-runner guards.
// No Firebase CLI, SDK requests, cloud access, or modifications.
import assert from "node:assert/strict";
import fs from "node:fs";
import {evaluateV71} from "./v71-public-readiness.mjs";
import {appIdEvidence} from "./v71-public-app-id-preflight.mjs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const runner=read("scripts/run-v71-emulators.sh");
const demo=read("scripts/test-v71-public-auth-firestore-emulator.mjs");
const backend=read("functions/index.js");
const assessment=read("scripts/v71-public-readiness.mjs");
const record=id=>({id,state:"pass"});
const source={checks:["F01","F02","F03","F04","F05","F06","F07"].map(record),
 counts:{pass:7,blocked:5,manual:9}};
const qa={pass:true,qaEnabled:false,publicFlagsOff:true};
const appId="1:123456:web:abcde123";
const web='export const firebaseConfig = {"projectId":"packtook-prod-01","authDomain":"packtook-prod-01.firebaseapp.com","appId":"'+appId+'"};';
const appEvidence=appIdEvidence({
 specific:"PACKTOOK_PUBLIC_CUSTOMER_APP_ID="+appId+"\n",
 customerConfig:web
});
assert.equal(appEvidence.exactMatch,true);
assert.equal(appIdEvidence({specific:"",customerConfig:web}).exactMatch,false);
assert.equal(appIdEvidence({specific:"PACKTOOK_PUBLIC_CUSTOMER_APP_ID=1:999:web:bad\n",customerConfig:web}).exactMatch,false);
assert.throws(()=>appIdEvidence({generic:"PACKTOOK_PUBLIC_CUSTOMER_APP_ID="+appId,customerConfig:web}),/SAFETY BLOCK/);
assert.throws(()=>appIdEvidence({specific:"PACKTOOK_PUBLIC_CUSTOMER_APP_ID="+appId+"\nPACKTOOK_PUBLIC_CUSTOMER_APP_ID="+appId,customerConfig:web}),/SAFETY BLOCK/);
const http={
 marketing:{http:200,prelaunchNotice:true},
 customer:{http:200,v66Script:true,hasSignupForm:true,hasVerifyStep:true},
 status:{http:200,reachable:true,publicSignupEnabled:false,
  publicAccessEnabled:false,policyVersion:"2026-11-v1",
  freeVideosPerMonth:20,freeDevices:1}
};
const good=evaluateV71({localQa:qa,source,remote:http,appEvidence});
assert.equal(good.readyForPublic,false);
assert.equal(good.decision,"NO_GO_PUBLIC");
assert.equal(good.local.publicFlagsOff,true);
assert.equal(good.source.criticalPass,true);
assert.equal(good.remote.httpPass,true);
assert(good.reasons.includes("OWNER_GO_NO_GO_SIGNOFF_REQUIRED"));
assert(good.reasons.includes("LEGAL_PDPA_TERMS_PRIVACY_APPROVAL_REQUIRED"));
assert.equal(good.customerAppId.exactMatch,true);
assert(evaluateV71({localQa:qa,source,remote:http}).reasons.includes("CUSTOMER_APP_ID_NOT_VERIFIED"));
const noRemote=evaluateV71({localQa:qa,source});
assert(noRemote.reasons.includes("REMOTE_STATUS_NOT_CHECKED"));
const opened=evaluateV71({localQa:qa,source,remote:{
 ...http,status:{...http.status,publicSignupEnabled:true}}});
assert(opened.reasons.includes("REMOTE_PUBLIC_GATE_OR_SITE_UNEXPECTED"));
const localUnsafe=evaluateV71({localQa:{...qa,qaEnabled:true},source,remote:http});
assert(localUnsafe.reasons.includes("LOCAL_QA_OR_PUBLIC_FLAGS_NOT_OFF"));
const unsafeSource=evaluateV71({localQa:qa,source:{
 ...source,checks:[{id:"F01",state:"blocked"},...source.checks.slice(1)]
}});
assert(unsafeSource.reasons.includes("SOURCE_SECURITY_GATE_INCOMPLETE"));
assert(runner.includes('DEMO="demo-packtook-v70"'));
assert(runner.includes("--only auth,firestore"));
assert(runner.includes("PACKTOOK_QA_DEMO_PROJECT=$DEMO"));
assert(runner.includes("test-v71-public-auth-firestore-emulator.mjs"));
assert(!/^[^#\n]*firebase deploy\b/m.test(runner),"DEMO runner must never deploy");
assert(!/^[^#\n]*gcloud\b/m.test(runner),"DEMO runner must never use gcloud");
assert(demo.includes("assertV70DemoEnvironment(process.env)"));
assert(demo.includes('const DEMO="demo-packtook-v70"'));
assert(demo.includes("PUBLIC FREE INTEGRATION PASS"));
assert(demo.includes("return {fn:exports,opts}"));
assert(!/process\.env\.PACKTOOK_PUBLIC_(?:SIGNUP|ACCESS|POLICIES)/.test(demo),
 "DEMO test must never change shell Public flags");
assert(backend.includes("exports.completeFreeSignup=onCall({...options,enforceAppCheck:true}"));
assert(backend.includes("PUBLIC_SIGNUP_ENABLED&&PUBLIC_ACCESS_ENABLED&&PUBLIC_POLICIES_APPROVED"));
assert(backend.includes("if(req.auth.token.packtookProductionBeta!==true&&!isPublicMember(req)&&!isQaMember(req)"));
assert(backend.includes("req.app?.appId===PUBLIC_CUSTOMER_APP_ID"));
assert(backend.includes("req.app?.appId!==PUBLIC_CUSTOMER_APP_ID"));
assert(backend.includes("PACKTOOK_PUBLIC_CUSTOMER_APP_ID"));
assert(assessment.includes("readyForPublic:false"));
assert(assessment.includes("decision:\"NO_GO_PUBLIC\""));
assert(!/^[^#\n]*firebase deploy\b/m.test(assessment));
console.log("PASS: V7.1 source/remote mismatch detects unsafe public switches");
console.log("PASS: DEMO-only Firebase Auth+Firestore guard and source policy contracts");
console.log("RESULT: PACKTOOK V7.1 READINESS SAFETY PASS (offline NO-GO; no deployment)");
