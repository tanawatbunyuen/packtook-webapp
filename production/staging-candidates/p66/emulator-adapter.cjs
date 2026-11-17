"use strict";
/* P66 local-only Admin SDK adapter for P65, never loaded by deployed Functions. */
const {createRequire}=require("node:module");
const path=require("node:path");
const {createStagingGate}=require("../p65/staging-authorization.cjs");
const DEMO="demo-packtook-p66";
const AUTH="127.0.0.1:9097";
const FIRESTORE="127.0.0.1:8097";
function requireEmulators(){
 if(process.env.FIREBASE_AUTH_EMULATOR_HOST!==AUTH||
    process.env.FIRESTORE_EMULATOR_HOST!==FIRESTORE||
    process.env.GCLOUD_PROJECT!==DEMO||
    process.env.GCP_PROJECT && process.env.GCP_PROJECT!==DEMO||
    process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT!==DEMO||
    process.env.FIREBASE_CONFIG||
    process.env.GOOGLE_APPLICATION_CREDENTIALS||
    process.env.FIREBASE_TOKEN||
    process.env.PACKTOOK_PRODUCTION_PROJECT_ID)
    throw Error("P66_EMULATOR_ONLY");
}
function connect(){
 requireEmulators();
 const admin=createRequire(path.resolve(__dirname,"../../functions/package.json"))("firebase-admin");
 const app=admin.apps.find(x=>x.name==="p66-isolated")||
           admin.initializeApp({projectId:DEMO},"p66-isolated");
 return {admin,app,auth:admin.auth(app),db:admin.firestore(app)};
}
function makeGate({auth,db,now,env}){
 requireEmulators();
 if(!auth||!db)throw Error("P66_MISSING_DEPENDENCIES");
 return createStagingGate({
   env,
   now,
   readControl:async()=>{
     const snap=await db.doc("pilotControls/p65").get();
     return snap.exists?snap.data():null;
   },
   readLiveUser:uid=>auth.getUser(uid)
 });
}
module.exports={connect,makeGate,requireEmulators,DEMO};
