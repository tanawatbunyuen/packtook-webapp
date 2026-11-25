"use strict";
/** P223 standalone IAM boundary probe; private Cloud Run invoker only.
 * Purely synthetic document GETs, no customer data, writes or account fields.
 * This proves this probe runtime's IAM only, NOT P188 deployment or G02 signoff.
 */
const {onRequest}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
const {getFirestore}=require("firebase-admin/firestore");
const crypto=require("node:crypto");
const PROJECT="packtook-staging";
const TEST_DB="g02-security-test";
const DEFAULT_DB="(default)";
if(TEST_DB===DEFAULT_DB)throw Error("G02_INVALID_DATABASE");
if(!admin.apps.length)admin.initializeApp({projectId:PROJECT});
const app=admin.app();
const safeDb=getFirestore(app,TEST_DB);
const defaultDb=getFirestore(app,DEFAULT_DB);
const options={region:"asia-southeast1",invoker:"private",maxInstances:1,timeoutSeconds:15};
function isDenied(e){
 const code=e&&e.code;
 return code===7||code===403||code==="PERMISSION_DENIED"||code==="permission-denied";
}
async function inspect(db,documentId){
 try{
  const snapshot=await db.collection("__g02_iam_boundary_probe__").doc(documentId).get();
  return snapshot.exists?"UNEXPECTED_DOCUMENT":"ALLOWED_NOT_FOUND";
 }catch(e){
  return isDenied(e)?"PERMISSION_DENIED":"UNDETERMINED";
 }
}
const verify=async(req,res)=>{
 // Private invoker gate is enforced by Cloud Run IAM before this handler.
 if(req.method!=="GET"){res.status(405).json({result:"METHOD_NOT_ALLOWED"});return;}
 const randomId="p223_missing_"+crypto.randomUUID().replace(/-/g,"");
 const [named,defaultDatabase]=await Promise.all([
  inspect(safeDb,randomId),inspect(defaultDb,randomId)
 ]);
 const passed=named==="ALLOWED_NOT_FOUND"&&defaultDatabase==="PERMISSION_DENIED";
 res.set("Cache-Control","no-store");
 res.status(passed?200:503).json({
  result:passed?"PASS":"BLOCKED",
  namedDatabase:named,
  defaultDatabase,
  scope:"P223_RUNTIME_IAM_ONLY",
  release:"NO_GO"
 });
};
exports.g02IamBoundaryProbe=onRequest(options,verify);
