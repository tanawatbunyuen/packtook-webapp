"use strict";
/* P57 static AST dependency guard. Offline only; neither equality nor a
 * structural match proves deployed runtime behavior or App Check enforcement.
 */
const ts=require("typescript");
const crypto=require("node:crypto");
const TARGETS=["recordingStatus","usageStatus"];
const REQUIRED=["guardedCall","isPilotToken","requirePilotLease","uid",
  "pilotEnvironmentClosed","validPilotControl","isQaMember","isPublicMember",
  "qaInviteValid","productionProjectReady"];
function fail(){throw Error("P57_NOT_VERIFIABLE");}
function parse(source){
 if(typeof source!=="string"||Buffer.byteLength(source)>1048576)fail();
 const file=ts.createSourceFile("private.js",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(file.parseDiagnostics.length)fail();
 return file;
}
function digest(node,file){
 const scan=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,node.getText(file));
 const hash=crypto.createHash("sha256");
 while(true){const k=scan.scan();if(k===ts.SyntaxKind.EndOfFileToken)break;
  hash.update(k+"|"+scan.getTokenText()+"\0");
 }
 return hash.digest("hex");
}
function collect(file){
 const funcs=new Map(),exports=new Map(),vars=new Map();
 for(const stmt of file.statements){
  if(ts.isFunctionDeclaration(stmt)&&stmt.name){
   const n=stmt.name.text;if(funcs.has(n))fail();funcs.set(n,stmt);
  }
  if(ts.isVariableStatement(stmt))for(const d of stmt.declarationList.declarations){
   if(ts.isIdentifier(d.name)){const n=d.name.text;if(vars.has(n))fail();vars.set(n,d);}
  }
  if(ts.isExpressionStatement(stmt)&&ts.isBinaryExpression(stmt.expression)&&
      stmt.expression.operatorToken.kind===ts.SyntaxKind.EqualsToken){
   const {left,right}=stmt.expression;
   if(ts.isPropertyAccessExpression(left)&&ts.isIdentifier(left.expression)&&left.expression.text==="exports"){
    if(exports.has(left.name.text))fail();exports.set(left.name.text,right);
   }
  }
 }
 return {funcs,exports,vars};
}
function namedCalls(root,name){
 let found=false;
 function walk(node){if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text===name)found=true;
  ts.forEachChild(node,walk);}
 walk(root);return found;
}
function member(root,base,field){
 let found=false;
 function walk(n){if(ts.isPropertyAccessExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text===base&&n.name.text===field)found=true;
  ts.forEachChild(n,walk);}
 walk(root);return found;
}
function text(node,file){return node.getText(file);}
function inspect(code){
 const file=parse(code),col=collect(file),parts={};
 for(const name of REQUIRED){const fn=col.funcs.get(name);if(!fn||!fn.body)fail();parts[name]=digest(fn,file);}
 const guard=col.funcs.get("guardedCall");
 // Require a guarded outer callback with a lease check before dispatch.
 if(!namedCalls(guard,"onCall")||!namedCalls(guard,"isPilotToken")||
    !namedCalls(guard,"requirePilotLease")||!namedCalls(guard,"add"))fail();
 const g=text(guard,file);
 if(!/PILOT_VALIDATED_REQUESTS\.add\s*\(\s*req\s*\)/.test(g)||
    !/return\s+handler\s*\(\s*req\s*\)/.test(g))fail();
 if(g.indexOf("requirePilotLease")>g.indexOf("return handler(req)"))fail();
 const uid=col.funcs.get("uid");
 if(!namedCalls(uid,"isPilotToken")||!member(uid,"PILOT_VALIDATED_REQUESTS","has")||
    !namedCalls(uid,"isPublicMember")||!namedCalls(uid,"isQaMember"))fail();
 const lease=col.funcs.get("requirePilotLease");
 if(!namedCalls(lease,"pilotEnvironmentClosed")||!namedCalls(lease,"validPilotControl")||
    !namedCalls(lease,"getUser") && !/admin\.auth\(\)\.getUser/.test(text(lease,file)))fail();
 if(!/req\.app\?\.appId/.test(text(lease,file))||!/invitedUids/.test(text(lease,file)))fail();
 const token=col.funcs.get("isPilotToken");
 if(!/packtookPilotV72/.test(text(token,file)))fail();
 for(const name of TARGETS){
  const exp=col.exports.get(name);
  if(!exp||!ts.isCallExpression(exp)||!ts.isIdentifier(exp.expression)||
     exp.expression.text!=="guardedCall"||exp.arguments.length!==2||
     !ts.isIdentifier(exp.arguments[0])||exp.arguments[0].text!=="options")fail();
  const cb=exp.arguments[1];
  if(!ts.isArrowFunction(cb)||!ts.isBlock(cb.body)||!namedCalls(cb,"uid"))fail();
  parts["export:"+name]=digest(exp,file);
 }
 const options=col.vars.get("options"),validated=col.vars.get("PILOT_VALIDATED_REQUESTS");
 if(!options||!validated||!validated.initializer||!ts.isNewExpression(validated.initializer)||
    !ts.isIdentifier(validated.initializer.expression)||
    validated.initializer.expression.text!=="WeakSet")fail();
 parts.options=digest(options,file);
 parts.PILOT_VALIDATED_REQUESTS=digest(validated,file);
 for(const name of ["PUBLIC_GATE","V72_PILOT_ENABLED","PUBLIC_CUSTOMER_APP_ID",
   "V7_QA_ENABLED","V7_QA_UID","V7_QA_APP_ID","V7_QA_EXPIRY",
   "PUBLIC_SIGNUP_ENABLED","PUBLIC_ACCESS_ENABLED","PUBLIC_POLICIES_APPROVED",
   "PILOT_V72_CONTROL"]){
  const v=col.vars.get(name);if(!v)fail();parts["config:"+name]=digest(v,file);
 }
 return parts;
}
function compare(review,deployed){
 const a=inspect(review),b=inspect(deployed);
 const changed=Object.keys(a).filter(k=>a[k]!==b[k]);
 return {targetCount:TARGETS.length,dependencyCount:Object.keys(a).length,
   state:changed.length?"DRIFT_REVIEW_REQUIRED":"EXACT_SCOPED_TOKENS_REVIEW_REQUIRED",
   changedDependencies:changed,
   backendEnforcement:"NOT_PROVEN",moduleEffects:"NOT_FULLY_REVIEWED",
   functionalEquivalence:"NOT_PROVEN",release:"NO_GO_RELEASE"};
}
module.exports={inspect,compare};
if(require.main===module){
 try{
  const raw=require("node:fs").readFileSync(0,"utf8");
  if(Buffer.byteLength(raw)>2500000)fail();
  const data=JSON.parse(raw);const result=compare(data.review,data.deployed);
  process.stdout.write(JSON.stringify(result)+"\n");
 }catch{process.stdout.write('{"error":"P57_NOT_VERIFIABLE","release":"NO_GO_RELEASE"}\n');process.exitCode=2;}
}
