"use strict";
/* P224 isolated private diagnostic. No customer documents, Firestore mutations,
 * secrets, error strings, details, tokens, or public invoker. Not G02 signoff. */
const {onRequest}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const {getFirestore}=require("firebase-admin/firestore");
const {randomUUID}=require("node:crypto");
const PROJECT="packtook-staging";
const NAMED_DB="g02-security-test";
const DEFAULT_DB="(default)";
if(NAMED_DB===DEFAULT_DB)throw Error("P224_NAMED_DB_MUST_BE_DISTINCT");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const app=admin.app();
const named=getFirestore(app,NAMED_DB);
const baseline=getFirestore(app,DEFAULT_DB);
const settings={region:"asia-southeast1",invoker:"private",maxInstances:1,timeoutSeconds:15};
const normalizedCode=e=>{
 const c=e&&e.code;
 if(c===7||c===403||c==="PERMISSION_DENIED"||c==="permission-denied")return "PERMISSION_DENIED";
 if(c===5||c===404||c==="NOT_FOUND"||c==="not-found")return "NOT_FOUND_ERROR";
 if(c===9||c==="FAILED_PRECONDITION"||c==="failed-precondition")return "FAILED_PRECONDITION";
 if(c===14||c===503||c==="UNAVAILABLE"||c==="unavailable")return "UNAVAILABLE";
 if(c===4||c===504||c==="DEADLINE_EXCEEDED"||c==="deadline-exceeded")return "DEADLINE_EXCEEDED";
 if(c===16||c===401||c==="UNAUTHENTICATED"||c==="unauthenticated")return "UNAUTHENTICATED";
 if(c===3||c===400||c==="INVALID_ARGUMENT"||c==="invalid-argument")return "INVALID_ARGUMENT";
 return "UNKNOWN_ERROR";
};
async function check(db,id){
 try{
  const snap=await db.collection("__g02_iam_boundary_probe__").doc(id).get();
  return snap.exists?"UNEXPECTED_DOCUMENT":"ALLOWED_NOT_FOUND";
 }catch(e){return normalizedCode(e);}
}
const handler=async(req,res)=>{
 res.set("Cache-Control","no-store");
 if(req.method!=="GET"){res.status(405).json({result:"METHOD_NOT_ALLOWED",release:"NO_GO"});return;}
 const id="p224_missing_"+randomUUID().replace(/-/g,"");
 const [namedDatabase,defaultDatabase]=await Promise.all([check(named,id),check(baseline,id)]);
 const pass=namedDatabase==="ALLOWED_NOT_FOUND"&&defaultDatabase==="PERMISSION_DENIED";
 res.status(pass?200:503).json({
  result:pass?"PASS":"BLOCKED",namedDatabase,defaultDatabase,
  scope:"P224_SAFE_ERROR_CODES_ONLY",release:"NO_GO"
 });
};
exports.g02IamDiagnosticProbe=onRequest(settings,handler);
