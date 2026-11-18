"use strict";
/* P68 static App Check / release gate. Does NOT assert actual deployment. */
const fs=require("node:fs"),ts=require("typescript");
const NAMES=["reserveCredit","finalizeCredit","recordingStatus","recoverStaleVideoReservation","usageStatus"];
function inspect(code){
 const sf=ts.createSourceFile("candidate.js",code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(sf.parseDiagnostics.length)throw Error("P68_NOT_VERIFIABLE");
 const vars=sf.statements.filter(ts.isVariableStatement);
 const opts=vars.flatMap(st=>st.declarationList.declarations)
  .filter(d=>ts.isIdentifier(d.name)&&d.name.text==="options");
 if(opts.length!==1||!opts[0].initializer||!ts.isObjectLiteralExpression(opts[0].initializer))
  throw Error("P68_NOT_VERIFIABLE");
 const properties=opts[0].initializer.properties;
 const enforce=properties.filter(p=>ts.isPropertyAssignment(p)&&
    (ts.isIdentifier(p.name)||ts.isStringLiteral(p.name))&&p.name.text==="enforceAppCheck");
 const explicit=enforce.length===1&&enforce[0].initializer.kind===ts.SyntaxKind.TrueKeyword;
 const checks={};
 for(const name of NAMES){
  const matches=sf.statements.filter(st=>ts.isExpressionStatement(st)&&
   ts.isBinaryExpression(st.expression)&&ts.isPropertyAccessExpression(st.expression.left)&&
   ts.isIdentifier(st.expression.left.expression)&&st.expression.left.expression.text==="exports"&&
   st.expression.left.name.text===name);
  if(matches.length!==1)throw Error("P68_NOT_VERIFIABLE");
  const expr=matches[0].expression.right;
  checks[name]=ts.isCallExpression(expr)&&ts.isIdentifier(expr.expression)&&
   expr.expression.text==="guardedCall"&&expr.arguments.length===2&&
   ts.isIdentifier(expr.arguments[0])&&expr.arguments[0].text==="options";
 }
 return {
  staticGuardedCall:NAMES.every(n=>checks[n])?"FIVE_FIVE_STATIC":"REVIEW_REQUIRED",
  reviewOptionsEnforceAppCheckLiteral:explicit?"TRUE":"NOT_EXPLICIT_TRUE",
  backendAppCheckEnforcement:"NOT_PROVEN",
  callableTransport:"MOCKED",
  stagingDeployedSource:"UNCHANGED",
  p65IntegratedInDeployedStaging:"NO",
  stagingDeploy:"BLOCKED_REVIEW_REQUIRED",
  productionRelease:"NO_GO_RELEASE"
 };
}
if(require.main===module){
 try{
  const a=inspect(fs.readFileSync(0,"utf8"));
  process.stdout.write(JSON.stringify(a)+"\n");
 }catch{
  process.stdout.write('{"error":"P68_NOT_VERIFIABLE","productionRelease":"NO_GO_RELEASE"}\n');
  process.exitCode=2;
 }
}
module.exports={inspect};
