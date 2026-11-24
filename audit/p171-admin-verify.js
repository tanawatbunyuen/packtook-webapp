#!/usr/bin/env node
"use strict";
/* P171 LOCAL ONLY Firebase Admin verifyIdToken: Auth Emulator only.
 * No backend import, recovered Owner functions, prod data, or cloud credentials.
 * Locally minted token values never logged or saved.
 */
const crypto=require("node:crypto");
const fs=require("node:fs");
const {createRequire}=require("node:module");
const path=require("node:path");
const http=require("node:http");
const assert=require("node:assert/strict");
const P170=require("./p170-jwt-boundary.js");
const P166=require("./p166-owner-claim-negative.js");
const BACKEND=path.join(__dirname,"../functions/index.js");
const EXPECTED="92262ea2fbbb941188937d72f0eea74a735d2bf3";
const PROJECT="demo-packtook-p171-admin-token";
const AUTH_HOST="127.0.0.1:19371";
function localGate(){
 if(P166.gitBlob(fs.readFileSync(BACKEND))!==EXPECTED)
   throw Error("P171_BLOCK=SOURCE_DRIFT");
 console.log("P171_GATE_SOURCE=PASS");
 if(process.env.GCLOUD_PROJECT!==PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT!==PROJECT ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!==AUTH_HOST ||
    process.env.FIREBASE_PROJECT_ID!==PROJECT)
   throw Error("P171_BLOCK=EMULATOR_ENV_NOT_ISOLATED");
 if(process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_CONFIG)
   throw Error("P171_BLOCK=AMBIENT_CLOUD_CREDENTIALS");
 console.log("P171_GATE_EMULATOR_ENV=PASS");
 const installed=path.join(process.env.HOME||"", "packtook-p168/functions/package.json");
 if(!fs.existsSync(installed))
   throw Error("P171_BLOCK=PINNED_P168_SDK_NOT_FOUND");
 const source=path.join(path.dirname(installed),"index.js");
 if(P166.gitBlob(fs.readFileSync(source))!==EXPECTED)
   throw Error("P171_BLOCK=P168_SOURCE_DRIFT");
 console.log("P171_GATE_P168_PINNED_SOURCE=PASS");
 const sdkRequire=createRequire(installed);
 let admin;
 try{admin=sdkRequire("firebase-admin");}
 catch{throw Error("P171_BLOCK=ADMIN_SDK_MODULE_RESOLUTION");}
 // Read metadata directly: package.json subpath may be blocked by package exports.
 let metadata;
 try{metadata=JSON.parse(fs.readFileSync(path.join(path.dirname(installed),"node_modules/firebase-admin/package.json"),"utf8"));}
 catch{throw Error("P171_BLOCK=ADMIN_SDK_METADATA_UNREADABLE");}
 if(metadata.name!=="firebase-admin")throw Error("P171_BLOCK=SDK_METADATA_MISMATCH");
 const ver=metadata.version;
 if(!/^13\.\d+\.\d+$/.test(ver))
   throw Error("P171_BLOCK=UNEXPECTED_ADMIN_SDK_MAJOR");
 console.log("P171_ADMIN_SDK_VERSION="+ver);
 console.log("P171_GATE_ADMIN_SDK_LOADED=PASS");
 return admin;
}
function postLocal(pathname,body){
 return new Promise((resolve,reject)=>{
  const bytes=Buffer.from(JSON.stringify(body));
  const req=http.request({
    hostname:"127.0.0.1",port:19371,path:pathname,method:"POST",
    timeout:5000,
    headers:{"content-type":"application/json",
             "content-length":bytes.length}},res=>{
    let chunks=[],total=0;
    res.on("data",b=>{total+=b.length;if(total<100000)chunks.push(b);});
    res.on("end",()=>{
      if(total>=100000)return reject(Error("too_large"));
      try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))});}
      catch{reject(Error("invalid_local_json"));}
    });
  });
  req.once("timeout",()=>req.destroy(Error("local_auth_timeout")));
  req.once("error",reject);req.end(bytes);
 });
}
function mutateSignature(token){
 const parts=token.split(".");
 if(parts.length!==3||parts[2].length<2)throw Error("not_jwt");
 // Tamper signature while keeping valid base64url characters.
 parts[2]=(parts[2][0]==="A"?"B":"A")+parts[2].slice(1);
 return parts.join(".");
}
function mutateAudienceWithoutResigning(token){
 const parts=token.split(".");
 const body=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
 body.aud="demo-another-p171-project";
 parts[1]=Buffer.from(JSON.stringify(body)).toString("base64url");
 return parts.join(".");
}
async function inspect(admin,token,label){
 let outcome="REJECTED";
 try{const decoded=await admin.auth().verifyIdToken(token);
   // Classification only. Never interpret emulator acceptance as a cryptographic proof.
   outcome=(decoded&&typeof decoded.uid==="string"?"ACCEPTED":"UNEXPECTED_RESULT");
 }catch(e){outcome="REJECTED";}
 console.log("P171_ADMIN_VERIFY_"+label+"="+outcome);
 return outcome;
}
async function main(){
 console.log("P171_MODE=LOCAL_AUTH_EMULATOR_ADMIN_VERIFY_ID_TOKEN");
 const admin=localGate();
 const source=P170.baseClaims();
 assert(source.packtookPlatformOwner===true); // previous P170 stays test-only.
 const app=admin.initializeApp({projectId:PROJECT},"p171-local-only");
 const email="p171-"+crypto.randomBytes(12).toString("hex")+"@example.invalid";
 const uid="p171-"+crypto.randomBytes(12).toString("hex");
 const password=crypto.randomBytes(24).toString("base64url");
 let created=false;
 try{
  const auth=admin.auth(app);
  await auth.createUser({uid,email,password,emailVerified:true});
  created=true;
  console.log("P171_SYNTHETIC_LOCAL_ACCOUNT_CREATED=PASS");
  // Custom claims are set only in the disposable Auth emulator.
  await auth.setCustomUserClaims(uid,{packtookPlatformOwner:false});
  const login=await postLocal(
   "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=p171-demo-only",
   {email,password,returnSecureToken:true});
  if(login.status!==200||typeof login.body.idToken!=="string")
    throw Error("P171_BLOCK=LOCAL_SIGNIN_FAILED");
  const good=login.body.idToken;
  console.log("P171_LOCAL_TOKEN_ISSUED=PASS");
  const valid=await inspect(admin,good,"LOCAL_VALID");
  const malformed=await inspect(admin,"invalid-p168-demo-token","MALFORMED");
  const broken=await inspect(admin,mutateSignature(good),"MUTATED_SIGNATURE");
  const wrong=await inspect(admin,mutateAudienceWithoutResigning(good),"MUTATED_AUDIENCE");
  if(valid!=="ACCEPTED")throw Error("P171_BLOCK=VALID_LOCAL_TOKEN_NOT_VERIFIED");
  if(malformed!=="REJECTED")throw Error("P171_BLOCK=MALFORMED_TOKEN_NOT_REJECTED");
  console.log("P171_LOCAL_VALID_AND_MALFORMED_CONTRACT=PASS");
  console.log("P171_MUTATED_SIGNATURE_EMULATOR_CRYPTO_ATTESTED=FALSE");
  console.log("P171_MUTATED_AUDIENCE_EMULATOR_CRYPTO_ATTESTED=FALSE");
  console.log("P171_LOCAL_ACCEPTANCE_IS_NOT_PRODUCTION_ATTESTATION=TRUE");
  console.log("P171_DECISION=ADMIN_EMULATOR_BEHAVIOR_OBSERVED_PRODUCTION_NO_GO");
 }finally{
  let cleaned=!created;
  if(created){
    try{await admin.auth(app).deleteUser(uid);cleaned=true;}
    catch{cleaned=false;}
  }
  console.log("P171_DISPOSABLE_USER_CLEANUP="+(cleaned?"PASS":"FAIL"));
  await app.delete();
  if(!cleaned)throw Error("P171_BLOCK=LOCAL_ACCOUNT_CLEANUP_FAILED");
 }
}
if(require.main===module)main().catch(e=>{
 const message=String(e&&e.message||"");
 console.log(message.startsWith("P171_BLOCK=")?message:
             "P171_BLOCK=LOCAL_VERIFY_ID_TOKEN_TEST_FAILED");
 process.exitCode=1;
});
module.exports={mutateSignature,mutateAudienceWithoutResigning,localGate};
