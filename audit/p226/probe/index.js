"use strict";
/* P226: private Staging Firestore API error-shape diagnostics; NOT a release gate.
 * Never returns raw errors/messages, tokens, document fields, IDs, or paths.
 * Uses random missing test-doc GETs only, no writes or customer reads. */
const {onRequest}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const {getFirestore}=require("firebase-admin/firestore");
const {GoogleAuth}=require("google-auth-library");
const crypto=require("node:crypto");
const PROJECT="packtook-staging";
const NAMED="g02-security-test";
const DEFAULT="(default)";
const COL="__g02_iam_boundary_probe__";
if(NAMED===DEFAULT)throw Error("P226_DATABASE_COLLISION");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const app=admin.app();
const dbNamed=getFirestore(app,NAMED);
const dbDefault=getFirestore(app,DEFAULT);
const auth=new GoogleAuth({scopes:["https://www.googleapis.com/auth/datastore"]});
const options={region:"asia-southeast1",invoker:"private",maxInstances:1,timeoutSeconds:30};
const codeFromValue=c=>{
 if(c===3||c===400||c==="INVALID_ARGUMENT"||c==="invalid-argument")return "INVALID_ARGUMENT";
 if(c===7||c===403||c==="PERMISSION_DENIED"||c==="permission-denied")return "PERMISSION_DENIED";
 if(c===5||c===404||c==="NOT_FOUND"||c==="not-found")return "NOT_FOUND";
 if(c===9||c===412||c==="FAILED_PRECONDITION"||c==="failed-precondition")return "FAILED_PRECONDITION";
 if(c===16||c===401||c==="UNAUTHENTICATED"||c==="unauthenticated")return "UNAUTHENTICATED";
 if(c===14||c===503||c==="UNAVAILABLE"||c==="unavailable")return "UNAVAILABLE";
 if(c===4||c===504||c==="DEADLINE_EXCEEDED"||c==="deadline-exceeded")return "DEADLINE_EXCEEDED";
 return "UNKNOWN";
};
// The message string is examined *only* against finite exact category patterns;
// it is never returned, logged, or saved. Never include arbitrary text in output.
function reasonCategory(message){
 if(typeof message!=="string")return "UNCLASSIFIED";
 if(/invalid database id/i.test(message))return "INVALID_DATABASE_ID";
 if(/invalid database name/i.test(message))return "INVALID_DATABASE_NAME";
 if(/database .* does not exist/i.test(message))return "DATABASE_NOT_FOUND";
 if(/invalid document (name|path)/i.test(message))return "INVALID_DOCUMENT_PATH";
 if(/invalid resource name/i.test(message))return "INVALID_RESOURCE_NAME";
 if(/missing or insufficient permissions/i.test(message))return "PERMISSION_TEXT";
 return "UNCLASSIFIED";
}
async function sdkProbe(db,id){
 try{
  const snap=await db.collection(COL).doc(id).get();
  return {code:snap.exists?"UNEXPECTED_DOCUMENT":"ALLOWED_NOT_FOUND",reason:"NONE"};
 }catch(e){
  return {code:codeFromValue(e&&e.code),reason:reasonCategory(e&&e.message)};
 }
}
// Only inspect an allowlisted subset of Status.error JSON on a non-200/404.
// Protect against oversized responses and malformed/non-JSON error responses.
async function sanitizedRestError(resp){
 const outerCode=codeFromValue(resp.status);
 try{
  const contentType=resp.headers&&resp.headers.get("content-type");
  const size=Number(resp.headers&&resp.headers.get("content-length"));
  if(contentType&&!contentType.toLowerCase().includes("json"))return {code:outerCode,reason:"NON_JSON_ERROR"};
  if(Number.isFinite(size)&&size>4096)return {code:outerCode,reason:"OVERSIZE_ERROR"};
  const raw=await resp.text();
  if(raw.length>4096)return {code:outerCode,reason:"OVERSIZE_ERROR"};
  const parsed=JSON.parse(raw);
  const status=parsed&&parsed.error&&parsed.error.status;
  const message=parsed&&parsed.error&&parsed.error.message;
  const safeStatus=typeof status==="string"?codeFromValue(status):outerCode;
  return {code:safeStatus==="UNKNOWN"?outerCode:safeStatus,reason:reasonCategory(message)};
 }catch(_e){
  return {code:outerCode,reason:"MALFORMED_ERROR"};
 }
}
async function restProbe(database,id,token){
 const url="https://firestore.googleapis.com/v1/projects/"+PROJECT+
  "/databases/"+database+"/documents/"+COL+"/"+id;
 try{
  const resp=await fetch(url,{
   method:"GET",redirect:"error",
   headers:{Authorization:"Bearer "+token,Accept:"application/json"},
   signal:AbortSignal.timeout(7000)
  });
  // A 404 from the synthetic document isn't definitive IAM authorization proof.
  if(resp.status===404)return {code:"DOCUMENT_NOT_FOUND",reason:"NONE"};
  if(resp.status===200)return {code:"UNEXPECTED_DOCUMENT",reason:"NONE"};
  return await sanitizedRestError(resp);
 }catch(_e){return {code:"NETWORK_OR_TIMEOUT",reason:"NONE"};}
}
async function tokenOrNull(){
 try{
  const client=await auth.getClient();
  const t=await client.getAccessToken();
  return t&&typeof t.token==="string"&&t.token.length>0?t.token:null;
 }catch(_e){return null;}
}
const handle=async(req,res)=>{
 res.set("Cache-Control","no-store");
 if(req.method!=="GET"){
  res.status(405).json({result:"METHOD_NOT_ALLOWED",release:"NO_GO"});return;
 }
 const id="p226_missing_"+crypto.randomUUID().replace(/-/g,"");
 const [namedSdk,defaultSdk]=await Promise.all([sdkProbe(dbNamed,id),sdkProbe(dbDefault,id)]);
 const token=await tokenOrNull();
 let namedRest={code:"AUTH_UNAVAILABLE",reason:"NONE"};
 let defaultRest={code:"AUTH_UNAVAILABLE",reason:"NONE"};
 if(token){
  [namedRest,defaultRest]=await Promise.all([
   restProbe(NAMED,id,token),restProbe(DEFAULT,id,token)
  ]);
 }
 const namedOkay=namedSdk.code==="ALLOWED_NOT_FOUND"&&namedRest.code==="DOCUMENT_NOT_FOUND";
 const defaultDenied=defaultSdk.code==="PERMISSION_DENIED"&&defaultRest.code==="PERMISSION_DENIED";
 const passed=namedOkay&&defaultDenied;
 res.status(passed?200:503).json({
  result:passed?"PASS":"BLOCKED",
  namedSdk,defaultSdk,namedRest,defaultRest,
  scope:"P226_REQUEST_SHAPE_DIAGNOSTIC_ONLY",release:"NO_GO"
 });
};
exports.g02RequestShapeProbe=onRequest(options,handle);
