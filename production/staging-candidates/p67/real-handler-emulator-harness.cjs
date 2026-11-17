"use strict";
/* P67 executes the unchanged REAL production/functions/index.js handlers
 * against an exclusively local demo Firebase Auth/Firestore emulator.
 * The vm mock ONLY intercepts transport and injects demo SDK resources.
 * Never deployed. Does NOT validate production runtime authorization.
 */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {createRequire}=require("node:module");
const PROJECT="demo-packtook-p67";
const ROOT=path.resolve(__dirname,"../..");
function requireIsolatedEmulators(){
 if(process.env.GCLOUD_PROJECT!==PROJECT||
    process.env.GCP_PROJECT!==PROJECT||
    process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:9098"||
    process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:8098"||
    process.env.GOOGLE_APPLICATION_CREDENTIALS||
    process.env.PACKTOOK_PRODUCTION_PROJECT_ID||
    process.env.FIREBASE_TOKEN)throw Error("P67_EMULATOR_ONLY");
 const raw=process.env.FIREBASE_CONFIG;
 if(raw){
  let config;try{config=JSON.parse(raw);}catch{throw Error("P67_EMULATOR_ONLY");}
  if(!config||config.projectId!==PROJECT)throw Error("P67_EMULATOR_ONLY");
 }
}
function loadRealHandlers(){
 requireIsolatedEmulators();
 const appRequire=createRequire(path.join(ROOT,"functions/package.json"));
 const firebaseAdmin=appRequire("firebase-admin");
 const app=firebaseAdmin.apps.find(x=>x.name==="p67-demo")||
   firebaseAdmin.initializeApp({projectId:PROJECT},"p67-demo");
 const db=firebaseAdmin.firestore(app),auth=firebaseAdmin.auth(app);
 const admin={
   initializeApp(){return app;},
   firestore:Object.assign(()=>db,{FieldValue:firebaseAdmin.firestore.FieldValue}),
   auth:()=>auth
 };
 const source=fs.readFileSync(path.join(ROOT,"functions/index.js"),"utf8");
 const functions={};
 const calls=[];
 const mockCall=(options,callback)=>{
  if(!options||typeof callback!=="function")throw Error("P67_INVALID_ONCALL");
  calls.push({enforceAppCheck:options.enforceAppCheck===true});
  return callback;
 };
 const sandbox={
  exports:functions,
  module:{exports:functions},
  process:{env:Object.freeze({
   // TEST-ONLY shim: allows legacy Beta uid check to execute with a DEMO
   // Firestore database. Never use as Staging policy or deployment config.
   PACKTOOK_PRODUCTION_PROJECT_ID:"packtook-prod-01",
   GCLOUD_PROJECT:PROJECT,
   GCP_PROJECT:PROJECT,
   PACKTOOK_PUBLIC_SIGNUP_ENABLED:"false",
   PACKTOOK_PUBLIC_ACCESS_ENABLED:"false",
   PACKTOOK_PUBLIC_POLICIES_APPROVED:"false",
   PACKTOOK_V72_PILOT_ENABLED:"false",
   PACKTOOK_V7_QA_ENABLED:"false"
  })},
  require(name){
   if(name==="firebase-admin")return admin;
   if(name==="firebase-functions/v2/https")return {
    onCall:mockCall,
    HttpsError:class HttpsError extends Error{
     constructor(code,message){super(message);this.code=code;this.name="HttpsError";}
    }};
   if(name==="firebase-functions/params")return {defineSecret:()=>({value:()=>{throw Error("P67_NO_SECRETS");}})};
   if(name==="firebase-functions/logger")return {info:()=>{},warn:()=>{},error:()=>{}};
   if(name==="node:crypto")return require("node:crypto");
   throw Error("P67_REQUIRE_BLOCKED");
  },
  Date,Math,Number,String,Boolean,Object,Array,Map,Set,WeakSet,Promise,RegExp,JSON,Buffer,
  console:{log(){throw Error("P67_NO_LOG");}}
 };
 // Do not alter source or extract/copy just the handler bodies.
 vm.runInNewContext(source,sandbox,{filename:"production-handler-in-memory.js",timeout:2000});
 const names=["reserveCredit","finalizeCredit","recordingStatus",
              "recoverStaleVideoReservation","usageStatus"];
 for(const name of names)if(typeof functions[name]!=="function")throw Error("P67_HANDLER_MISSING");
 return {db,auth,app,functions,calls};
}
module.exports={loadRealHandlers,requireIsolatedEmulators,PROJECT};
