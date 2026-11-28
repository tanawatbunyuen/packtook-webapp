"use strict";
/**
 * Strict local-only backend source load preflight. No cloud SDK fetches and
 * no Firestore reads/writes. Running this script requires synthetic emulator
 * endpoints and an exact demo project, but the endpoints need not be live.
 */
const assert=require("node:assert/strict");
const path=require("node:path");
const project="demo-packtook-integrated-01";
const envProject=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT||"";
if(envProject!==project||process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8080"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9099"){
 console.error("PACKTOOK_BOOT_PREFLIGHT=DENIED_NONDEMO_ENV");
 process.exit(2);
}
try{
 const mod=require(path.resolve("functions/index.js"));
 const fns=Object.entries(mod).filter(([,value])=>typeof value==="function");
 const expected=["inviteOperator","acceptOperatorInvite","usageStatus","reserveCredit","finalizeCredit"];
 for(const name of expected)assert.equal(typeof mod[name],"function",name+" missing export");
 console.log("PACKTOOK_BOOT_PREFLIGHT=PASS");
 console.log("PACKTOOK_BOOT_EXPORT_COUNT="+fns.length);
 console.log("PACKTOOK_BOOT_MISSING_OPERATOR_DEPS=NONE");
 console.log("PACKTOOK_FIRESTORE_REQUESTS=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}catch(err){
 console.error("PACKTOOK_BOOT_PREFLIGHT=FAIL");
 console.error("PACKTOOK_BOOT_ERROR="+err.stack);
 process.exitCode=2;
}
