"use strict";
/* PACKTOOK V7 callable wrapper and App Check static gate review.
 * AST source analysis ONLY; no runtime calls, behavioral proof or clearance.
 * Inputs via stdin; output allowlisted classifications without source text.
 */
const fs=require("node:fs");
const ts=require("typescript");
const crypto=require("node:crypto");
const TARGETS=new Set(["recordingStatus","usageStatus"]);
const APP_STATES=new Set(["TRUE_LITERAL_IN_OPTIONS","FALSE_LITERAL_IN_OPTIONS",
 "NO_ENFORCEMENT_LITERAL_IN_OPTIONS","UNRESOLVED_OPTIONS","CONFLICTING_OPTIONS"]);
function fail(){throw new Error("NOT_VERIFIABLE");}
function parse(code){
 if(typeof code!=="string"||Buffer.byteLength(code)>1048576)fail();
 const file=ts.createSourceFile("private.js",code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(file.parseDiagnostics.length)fail();
 return file;
}
function tokenDigest(text){
 const h=crypto.createHash("sha256");
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,text);
 for(;;){
  const kind=scanner.scan();
  if(kind===ts.SyntaxKind.EndOfFileToken)break;
  h.update(kind+"|"+scanner.getTokenText()+"\0");
 }
 return h.digest("hex");
}
function exportCall(file,name){
 const matches=[];
 for(const stmt of file.statements){
  if(!ts.isExpressionStatement(stmt)||!ts.isBinaryExpression(stmt.expression))continue;
  const exp=stmt.expression, left=exp.left;
  if(exp.operatorToken.kind!==ts.SyntaxKind.EqualsToken||!ts.isPropertyAccessExpression(left))continue;
  if(!ts.isIdentifier(left.expression)||left.expression.text!=="exports"||left.name.text!==name)continue;
  if(!ts.isCallExpression(exp.right)||exp.right.arguments.length!==2)fail();
  const call=exp.right,cb=call.arguments[1];
  if(!ts.isArrowFunction(cb)&&!ts.isFunctionExpression(cb))fail();
  if(!ts.isBlock(cb.body))fail();
  matches.push({call,cb});
 }
 if(matches.length!==1)fail();
 return matches[0];
}
function objectFor(file,arg){
 if(ts.isObjectLiteralExpression(arg))return arg;
 if(!ts.isIdentifier(arg))return null;
 let matches=[];
 for(const st of file.statements){
  if(!ts.isVariableStatement(st))continue;
  for(const dec of st.declarationList.declarations){
   if(ts.isIdentifier(dec.name)&&dec.name.text===arg.text)matches.push(dec.initializer);
  }
 }
 if(matches.length!==1||!matches[0]||!ts.isObjectLiteralExpression(matches[0]))return null;
 return matches[0];
}
function optionState(file,arg){
 const obj=objectFor(file,arg);
 if(!obj)return "UNRESOLVED_OPTIONS";
 let hits=[];
 for(const prop of obj.properties){
  if(!ts.isPropertyAssignment(prop))return "UNRESOLVED_OPTIONS";
  const key=prop.name;
  if(!ts.isIdentifier(key)&&!ts.isStringLiteral(key))return "UNRESOLVED_OPTIONS";
  if(key.text==="enforceAppCheck"){
   if(prop.initializer.kind===ts.SyntaxKind.TrueKeyword)hits.push("TRUE");
   else if(prop.initializer.kind===ts.SyntaxKind.FalseKeyword)hits.push("FALSE");
   else return "UNRESOLVED_OPTIONS";
  }
 }
 if(hits.length>1)return "CONFLICTING_OPTIONS";
 if(!hits.length)return "NO_ENFORCEMENT_LITERAL_IN_OPTIONS";
 return hits[0]==="TRUE"?"TRUE_LITERAL_IN_OPTIONS":"FALSE_LITERAL_IN_OPTIONS";
}
function callbackHeader(cb,file){
 // Excludes callback body; detects async, args, defaults, destructuring and
 // implicit wrapper-level expression changes. Not a runtime proof.
 const start=cb.getStart(file),end=cb.body.getStart(file);
 if(end<=start)fail();
 return tokenDigest(file.text.slice(start,end));
}
function details(code,name){
 if(!TARGETS.has(name))fail();
 const file=parse(code),{call,cb}=exportCall(file,name);
 const callee=call.expression;
 const direct=ts.isIdentifier(callee)&&callee.text==="onCall";
 return {
   callee:direct?"DIRECT_ONCALL":"UNRESOLVED_CALLEE",
   calleeDigest:tokenDigest(callee.getText(file)),
   callbackHeaderDigest:callbackHeader(cb,file),
   optionsArgumentDigest:tokenDigest(call.arguments[0].getText(file)),
   optionState:optionState(file,call.arguments[0])
 };
}
function inspect(review,deployed,name){
 const a=details(review,name),b=details(deployed,name);
 if(!APP_STATES.has(a.optionState)||!APP_STATES.has(b.optionState))fail();
 return {
  name,
  callableCallee:a.callee===b.callee&&a.calleeDigest===b.calleeDigest
     ?"EXACT_CALLEE_TOKENS":"DRIFT_CALLEE_TOKENS",
  callbackHeader:a.callbackHeaderDigest===b.callbackHeaderDigest
     ?"EXACT_CALLBACK_HEADER_TOKENS":"DRIFT_CALLBACK_HEADER_TOKENS",
  optionsArgument:a.optionsArgumentDigest===b.optionsArgumentDigest
     ?"EXACT_OPTIONS_ARGUMENT_TOKENS":"DRIFT_OPTIONS_ARGUMENT_TOKENS",
  sourceAppCheck:a.optionState,
  deployedAppCheck:b.optionState,
  directOnCallBoth:a.callee==="DIRECT_ONCALL"&&b.callee==="DIRECT_ONCALL",
  moduleEffects:"NOT_REVIEWED",
  backendEnforcement:"NOT_PROVEN",
  functionalEquivalence:"NOT_PROVEN",
  functionGate:"REVIEW_REQUIRED"
 };
}
function main(){
 try{
  const raw=fs.readFileSync(0,"utf8");
  if(Buffer.byteLength(raw)>2500000)fail();
  const value=JSON.parse(raw);
  const result=inspect(value.review,value.deployed,value.name);
  process.stdout.write(JSON.stringify(result)+"\n");
 }catch{
  process.stdout.write(JSON.stringify({error:"WRAPPER_REVIEW_NOT_VERIFIABLE"})+"\n");
  process.exitCode=2;
 }
}
if(require.main===module)main();
module.exports={inspect,optionState,details};
