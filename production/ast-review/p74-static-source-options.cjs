"use strict";
/* P74 bounded static source option audit, separate from live evidence.
   No Firebase SDK, no service account, no network.
 */
const fs=require("node:fs"),ts=require("typescript");
function read(source){
 if(typeof source!=="string"||source.length>500000)throw Error("BAD_SOURCE");
 const ast=ts.createSourceFile("source.js",source,ts.ScriptTarget.Latest,true);
 if(ast.parseDiagnostics.length)throw Error("BAD_AST");
 const declarations=[];
 for(const st of ast.statements)if(ts.isVariableStatement(st)){
  for(const d of st.declarationList.declarations)
   if(ts.isIdentifier(d.name)&&d.name.text==="options")declarations.push(d.initializer);
 }
 if(declarations.length!==1)throw Error("OPTIONS_NOT_UNIQUE");
 const opt=declarations[0];
 if(!ts.isObjectLiteralExpression(opt)&&!(
   ts.isCallExpression(opt)&&ts.isPropertyAccessExpression(opt.expression)&&
   opt.expression.name.text==="freeze"&&opt.arguments.length===1&&
   ts.isObjectLiteralExpression(opt.arguments[0])
 ))throw Error("OPTIONS_DYNAMIC");
 const obj=ts.isObjectLiteralExpression(opt)?opt:opt.arguments[0];
 const matches=obj.properties.filter(p=>ts.isPropertyAssignment(p)&&
   (ts.isIdentifier(p.name)||ts.isStringLiteral(p.name))&&p.name.text==="enforceAppCheck");
 const explicitTrue=matches.length===1&&matches[0].initializer.kind===ts.SyntaxKind.TrueKeyword;
 const explicitFalse=matches.length===1&&matches[0].initializer.kind===ts.SyntaxKind.FalseKeyword;
 return {staticAppCheck:explicitTrue?"EXPLICIT_TRUE":explicitFalse?"EXPLICIT_FALSE":"NOT_EXPLICIT",
  backendAppCheck:"NOT_PROVEN"};
}
function compare(review,candidate){
 const r=read(review),c=read(candidate);
 return {schema:"P74_SOURCE_V1",
  reviewAppCheck:r.staticAppCheck,candidateAppCheck:c.staticAppCheck,
  p63DeployedGuardDrift:"REVIEW_REQUIRED",
  liveIam:"NOT_VERIFIED",backendAppCheck:"NOT_PROVEN",
  stagingDeploy:"BLOCKED",release:"NO_GO_RELEASE"};
}
module.exports={read,compare};
if(require.main===module){
 try{
  if(process.argv.length!==4)throw Error("ARGS");
  process.stdout.write(JSON.stringify(compare(...process.argv.slice(2).map(p=>fs.readFileSync(p,"utf8"))))+"\n");
 }catch{
  process.stdout.write('{"schema":"P74_SOURCE_V1","error":"NOT_VERIFIABLE","stagingDeploy":"BLOCKED","release":"NO_GO_RELEASE"}\n');
  process.exitCode=2;
 }
}
