"use strict";
/**
 * Local-only App Check enforcement negative tests WITH VALID synthetic Firebase
 * Auth Emulator ID token. Does not bypass, spoof, or disable App Check.
 */
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const admin=require("firebase-admin");
const PROJECT="demo-packtook-integrated-01";
const goodHost=h=>/^(127\.0\.0\.1|localhost):\d{2,5}$/.test(h||"");
if((process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT)!==PROJECT||
 !goodHost(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
 !goodHost(process.env.FIRESTORE_EMULATOR_HOST)||
 !goodHost(process.env.FIREBASE_EMULATOR_HUB)){
 console.error("PACKTOOK_APPCHECK_NEGATIVE=BLOCKED_NOT_LOCAL_DEMO");
 process.exit(2);
}
const app=admin.initializeApp({projectId:PROJECT},"packtook-appcheck-negative-"+process.pid);
const auth=app.auth();
async function main(){
 const uid="appcheck"+crypto.randomBytes(8).toString("hex"),email=uid+"@example.test";
 const password="LocalTest-"+crypto.randomBytes(12).toString("hex")+"A1!";
 await auth.createUser({uid,email,password,emailVerified:true});
 const r=await fetch("http://"+process.env.FIREBASE_AUTH_EMULATOR_HOST+
  "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(15000)});
 const result=await r.json();
 assert.equal(r.status,200,"Auth emulator signIn failed");
 const token=result.idToken;
 assert.ok(token&&typeof token==="string");
 const decoded=await auth.verifyIdToken(token);
 assert.equal(decoded.uid,uid);
 console.log("PACKTOOK_AUTH_EMULATOR_TOKEN_VERIFIED=PASS");
 let passed=0;
 for(const [label,extra] of [
  ["MISSING_APP_CHECK",{}],
  ["INVALID_APP_CHECK",{"X-Firebase-AppCheck":"definitely-not-a-real-app-check-token"}]
 ]){
  const response=await fetch("http://127.0.0.1:5001/"+PROJECT+"/asia-southeast1/accountRole",{
   method:"POST",headers:{"content-type":"application/json","Authorization":"Bearer "+token,...extra},
   body:JSON.stringify({data:{}}),signal:AbortSignal.timeout(25000)});
  const body=await response.text();let data;
  try{data=JSON.parse(body)}catch{throw Error(label+" returned non-JSON "+response.status)}
  console.log("PACKTOOK_VALID_AUTH_"+label+"_HTTP="+response.status);
  assert.equal(response.status,401,label+": App Check was not enforced: "+body.slice(0,300));
  assert.equal(data.error?.status,"UNAUTHENTICATED");
  passed++;
 }
 const standalone=await app.firestore().collection("accounts").doc(uid).get();
 assert.equal(standalone.exists,false,"Rejected requests unexpectedly created an account");
 console.log("PACKTOOK_VALID_AUTH_APPCHECK_NEGATIVE="+passed+"/2_PASS");
 console.log("PACKTOOK_REJECTED_REQUEST_SIDE_EFFECTS=NONE");
 console.log("PACKTOOK_AUTHENTICATED_OWNER_OPERATOR_POSITIVE=NOT_TESTED");
 console.log("PACKTOOK_VALID_APPCHECK_TOKEN=NOT_TESTED");
 console.log("PACKTOOK_LOCAL_AUTH_FIXTURE_WRITES=YES");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
main().catch(e=>{console.error("PACKTOOK_VALID_AUTH_APPCHECK_NEGATIVE_FAIL="+e.stack);process.exitCode=2})
.finally(async()=>{await app.delete()});
