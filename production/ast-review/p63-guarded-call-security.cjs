"use strict";
/* P63 static guarded-call attestation: classifies evidence, never runtime proof. */
const ts=require("typescript");
const fs=require("node:fs");
const {compare}=require("./p57-wrapper-dependency-ast.cjs");
const TARGETS=["recordingStatus","usageStatus"];
function fail(){throw Error("P63_NOT_VERIFIABLE");}
function parse(code){
 if(typeof code!=="string"||Buffer.byteLength(code)>1048576)fail();
 const sf=ts.createSourceFile("p63.js",code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(sf.parseDiagnostics.length)fail();
 return sf;
}
function callable(sf,name){
 const found=[];
 for(const st of sf.statements){
  if(!ts.isExpressionStatement(st)||!ts.isBinaryExpression(st.expression))continue;
  const {left,right,operatorToken}=st.expression;
  if(operatorToken.kind!==ts.SyntaxKind.EqualsToken||!ts.isPropertyAccessExpression(left)||
     !ts.isIdentifier(left.expression)||left.expression.text!=="exports"||left.name.text!==name)continue;
  if(!ts.isCallExpression(right)||right.arguments.length!==2||
     !ts.isIdentifier(right.expression)||!ts.isIdentifier(right.arguments[0]))fail();
  found.push({callee:right.expression.text,options:right.arguments[0].text});
 }
 if(found.length!==1)fail();
 return found[0];
}
function check(review,deployed){
 const a=parse(review),b=parse(deployed);
 const reports={};
 for(const name of TARGETS){
  const r=callable(a,name),d=callable(b,name);
  reports[name]={
   reviewGuarded:r.callee==="guardedCall"&&r.options==="options",
   deployedGuarded:d.callee==="guardedCall"&&d.options==="options",
   calleeMatch:r.callee===d.callee,
   optionsIdentifierMatch:r.options===d.options
  };
 }
 // All required guards must be present and identical at the scoped AST token
 // level. Never infer this from callback-only statement matches.
 let result=null;
 try{result=compare(review,deployed);}catch{result=null;}
 const staticMatch=!!result&&result.state==="EXACT_SCOPED_TOKENS_REVIEW_REQUIRED"&&
   TARGETS.every(name=>reports[name].reviewGuarded&&reports[name].deployedGuarded&&
                   reports[name].calleeMatch&&reports[name].optionsIdentifierMatch);
 return {
  state:staticMatch?"STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY":"SECURITY_GUARD_DRIFT_REVIEW_REQUIRED",
  recordingStatus:reports.recordingStatus,
  usageStatus:reports.usageStatus,
  scopedDependencies:result?result.state:"NOT_VERIFIABLE",
  backendAppCheck:"NOT_PROVEN",
  runtimeEquivalence:"NOT_PROVEN",
  release:"NO_GO_RELEASE"
 };
}
module.exports={check};
if(require.main===module){
 try{
  const raw=fs.readFileSync(0,"utf8");if(Buffer.byteLength(raw)>2500000)fail();
  const data=JSON.parse(raw);
  process.stdout.write(JSON.stringify(check(data.review,data.deployed))+"\n");
 }catch{
  process.stdout.write('{"error":"P63_NOT_VERIFIABLE","release":"NO_GO_RELEASE"}\n');
  process.exitCode=2;
 }
}
