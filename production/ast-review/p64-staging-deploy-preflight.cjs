"use strict";
/* P64 fail-closed Staging remediation PRE-FLIGHT. No deploy, no runtime approval. */
const fs=require("node:fs"),ts=require("typescript");
const TARGETS=["reserveCredit","finalizeCredit","recordingStatus","recoverStaleVideoReservation","usageStatus"];
function parse(source){
 if(typeof source!=="string"||Buffer.byteLength(source)>1048576)throw Error("P64_INVALID_SOURCE");
 const sf=ts.createSourceFile("p64.js",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(sf.parseDiagnostics.length)throw Error("P64_PARSE_BLOCKED");
 return sf;
}
function exportsMap(sf){
 const out=new Map();
 for(const st of sf.statements){
  if(!ts.isExpressionStatement(st)||!ts.isBinaryExpression(st.expression))continue;
  const {left,right,operatorToken}=st.expression;
  if(operatorToken.kind!==ts.SyntaxKind.EqualsToken||!ts.isPropertyAccessExpression(left)||
   !ts.isIdentifier(left.expression)||left.expression.text!=="exports")continue;
  if(out.has(left.name.text))throw Error("P64_DUPLICATE_EXPORT");
  out.set(left.name.text,right);
 }
 return out;
}
function functionNamed(sf,name){
 const hits=sf.statements.filter(x=>ts.isFunctionDeclaration(x)&&x.name?.text===name);
 if(hits.length!==1||!hits[0].body)throw Error("P64_FUNCTION_MISSING");
 return hits[0];
}
function contains(node,pred){
 let yes=false;
 const walk=n=>{if(pred(n))yes=true;ts.forEachChild(n,walk);};
 walk(node);return yes;
}
function check(source){
 const sf=parse(source),exports=exportsMap(sf);
 const callables={};
 for(const name of TARGETS){
  const e=exports.get(name);
  const guarded=!!e&&ts.isCallExpression(e)&&ts.isIdentifier(e.expression)&&
    e.expression.text==="guardedCall"&&e.arguments.length===2&&
    ts.isIdentifier(e.arguments[0])&&e.arguments[0].text==="options";
  callables[name]=guarded?"GUARDED_STATIC":"NOT_GUARDED_STATIC";
 }
 const uid=functionNamed(sf,"uid");
 const guard=functionNamed(sf,"guardedCall");
 const lease=functionNamed(sf,"requirePilotLease");
 const uidReferencesProduction=contains(uid,n=>ts.isStringLiteral(n)&&n.text==="packtook-prod-01");
 const pilotUsesProduction=contains(functionNamed(sf,"productionProjectReady"),n=>
   ts.isStringLiteral(n)&&n.text==="packtook-prod-01");
 const leaseChecksAppId=contains(lease,n=>ts.isPropertyAccessExpression(n)&&n.name.text==="appId");
 const guardCallsLease=contains(guard,n=>ts.isCallExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==="requirePilotLease");
 // Review source is Production-specific. Staging compatibility needs a separate
 // owner-approved design, not a search/replace of production project checks.
 const stagingAuthCompatible=!uidReferencesProduction&&!pilotUsesProduction;
 const guardedAll=TARGETS.every(x=>callables[x]==="GUARDED_STATIC");
 return {
  callableGuards:callables,
  pilotLeaseReference:guardCallsLease?"PRESENT_STATIC":"MISSING",
  pilotAppIdCheck:leaseChecksAppId?"PRESENT_STATIC":"MISSING",
  stagingAuthorization:stagingAuthCompatible?"NOT_PROVEN":"PRODUCTION_BOUND_REVIEW_REQUIRED",
  appCheck:"NOT_PROVEN",
  deployedSource:"NOT_INSPECTED",
  stagingDeployment:"BLOCKED_REVIEW_REQUIRED",
  productionRelease:"NO_GO_RELEASE",
  candidateReadyForDeployment:false,
  staticGuardCompleteness:guardedAll?"ALL_FIVE_GUARDED":"GUARD_GAP"
 };
}
module.exports={check};
if(require.main===module){
 try{
  const raw=fs.readFileSync(0,"utf8");
  const out=check(raw);
  process.stdout.write(JSON.stringify(out)+"\n");
 }catch{
  process.stdout.write('{"error":"P64_NOT_VERIFIABLE","productionRelease":"NO_GO_RELEASE","stagingDeployment":"BLOCKED_REVIEW_REQUIRED"}\n');
  process.exitCode=2;
 }
}
