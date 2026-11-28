"use strict";
/**
 * Local-only App Check enforcement negative tests WITH VALID synthetic Firebase
 * Auth Emulator ID token. Documents emulator placeholder-token acceptance,
 * which is NOT evidence of production App Check verification.
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
 let missingRejected=false,invalidPlaceholderAccepted=false;
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
  if(label==="MISSING_APP_CHECK"){
   assert.equal(response.status,401,"Missing App Check must be rejected");
   assert.equal(data.error?.status,"UNAUTHENTICATED");
   missingRejected=true;
  }else{
   // The local Firebase emulator may treat any nonempty App Check header as
   // valid. Never interpret that as production integrity verification.
   invalidPlaceholderAccepted=response.status===200&&!!data.result;
   assert.equal(invalidPlaceholderAccepted,true,
    "Emulator App Check behavior changed: review before continuing");
  }
 }
 assert.equal(missingRejected,true);
 console.log("PACKTOOK_VALID_AUTH_MISSING_APPCHECK_REJECTION=1/1_PASS");
 console.log("PACKTOOK_INVALID_APPCHECK_EMULATOR_ACCEPTED="+invalidPlaceholderAccepted);
 console.log("PACKTOOK_EMULATOR_APPCHECK_CRYPTOGRAPHIC_VERIFICATION=NOT_PROVEN");
 console.log("PACKTOOK_STAGING_APPCHECK_NEGATIVE=NOT_TESTED");
 console.log("PACKTOOK_APP_CHECK_PRODUCTION_GATE=OPEN");
 console.log("PACKTOOK_AUTHENTICATED_OWNER_OPERATOR_POSITIVE=NOT_TESTED");
 console.log("PACKTOOK_VALID_APPCHECK_TOKEN=NOT_TESTED");
 console.log("PACKTOOK_LOCAL_AUTH_FIXTURE_WRITES=YES");
 console.log("PACKTOOK_CLOUD_WRITES=0");
 console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
 console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
}
main().catch(e=>{console.error("PACKTOOK_VALID_AUTH_APPCHECK_NEGATIVE_FAIL="+e.stack);process.exitCode=2})
.finally(async()=>{await app.delete()});
