"use strict";
/* P225: private read-only SDK vs REST differential. Staging ONLY.
 * Never reveal access tokens, raw errors, response bodies, or document IDs.
 * P188/G02 release remains NO_GO. Do not deploy with public invoker. */
const {onRequest}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const {getFirestore}=require("firebase-admin/firestore");
const {GoogleAuth}=require("google-auth-library");
const {randomUUID}=require("node:crypto");
const PROJECT="packtook-staging";
const NAMED="g02-security-test";
const DEFAULT="(default)";
const COLLECTION="__g02_iam_boundary_probe__";
if(NAMED===DEFAULT)throw Error("P225_DATABASES_NOT_DISTINCT");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const app=admin.app();
const namedDb=getFirestore(app,NAMED);
const defaultDb=getFirestore(app,DEFAULT);
const googleAuth=new GoogleAuth({scopes:["https://www.googleapis.com/auth/datastore"]});
const settings={region:"asia-southeast1",invoker:"private",maxInstances:1,timeoutSeconds:30};
function classify(code){
 if(code===7||code===403||code==="PERMISSION_DENIED"||code==="permission-denied")return "PERMISSION_DENIED";
 if(code===5||code===404||code==="NOT_FOUND"||code==="not-found")return "NOT_FOUND_ERROR";
 if(code===3||code===400||code==="INVALID_ARGUMENT"||code==="invalid-argument")return "INVALID_ARGUMENT";
 if(code===9||code===412||code==="FAILED_PRECONDITION"||code==="failed-precondition")return "FAILED_PRECONDITION";
 if(code===14||code===503||code==="UNAVAILABLE"||code==="unavailable")return "UNAVAILABLE";
 if(code===4||code===504||code==="DEADLINE_EXCEEDED"||code==="deadline-exceeded")return "DEADLINE_EXCEEDED";
 if(code===16||code===401||code==="UNAUTHENTICATED"||code==="unauthenticated")return "UNAUTHENTICATED";
 return "UNKNOWN_ERROR";
}
async function sdkRead(db,id){
 try{
  const s=await db.collection(COLLECTION).doc(id).get();
  return s.exists?"UNEXPECTED_DOCUMENT":"ALLOWED_NOT_FOUND";
 }catch(e){return classify(e&&e.code);}
}
async function restRead(database,id,token){
 const path="projects/"+PROJECT+"/databases/"+database+"/documents/"+COLLECTION+"/"+id;
 const url="https://firestore.googleapis.com/v1/"+path;
 try{
  const resp=await fetch(url,{
   method:"GET",redirect:"error",
   headers:{Authorization:"Bearer "+token,Accept:"application/json"},
   signal:AbortSignal.timeout(7500)
  });
  // HTTP 404 for a randomly missing document means the API accepted the request.
  // No response body is accessed, so no document fields or server error details leak.
  if(resp.status===404)return "ALLOWED_NOT_FOUND";
  if(resp.status===200)return "UNEXPECTED_DOCUMENT";
  return classify(resp.status);
 }catch(_e){return "NETWORK_OR_TIMEOUT_ERROR";}
}
async function authAccessToken(){
 try{
  const client=await googleAuth.getClient();
  const token=await client.getAccessToken();
  return token&&typeof token.token==="string"&&token.token.length>0?token.token:null;
 }catch(_e){return null;}
}
const handler=async(req,res)=>{
 res.set("Cache-Control","no-store");
 if(req.method!=="GET"){
  res.status(405).json({result:"METHOD_NOT_ALLOWED",release:"NO_GO"});
  return;
 }
 const id="p225_missing_"+randomUUID().replace(/-/g,"");
 // No auth token leaves the runtime. Requests are hard-pinned to Firestore API.
 const token=await authAccessToken();
 const [namedSdk,defaultSdk]=await Promise.all([
  sdkRead(namedDb,id),sdkRead(defaultDb,id)
 ]);
 let namedRest="AUTH_TOKEN_UNAVAILABLE",defaultRest="AUTH_TOKEN_UNAVAILABLE";
 if(token){
  [namedRest,defaultRest]=await Promise.all([
   restRead(NAMED,id,token),restRead(DEFAULT,id,token)
  ]);
 }
 const pass=namedSdk==="ALLOWED_NOT_FOUND"&&defaultSdk==="PERMISSION_DENIED"&&
  namedRest==="ALLOWED_NOT_FOUND"&&defaultRest==="PERMISSION_DENIED";
 res.status(pass?200:503).json({
  result:pass?"PASS":"BLOCKED",
  namedSdk,defaultSdk,namedRest,defaultRest,
  scope:"P225_SDK_REST_DIFFERENTIAL_ONLY",release:"NO_GO"
 });
};
exports.g02SdkRestDiagnosticProbe=onRequest(settings,handler);
