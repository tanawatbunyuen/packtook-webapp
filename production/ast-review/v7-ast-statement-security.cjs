"use strict";
/* PACKTOOK V7 AST statement-level security triage, synthetic/offline and
 * pinned Staging RAM-only. Output ONLY allowlisted counts and flags.
 * Syntax-node comparison is static evidence, NOT functional equivalence.
 */
const fs=require("node:fs");
const ts=require("typescript");
const crypto=require("node:crypto");
const NAMES=new Set(["recordingStatus","usageStatus"]);
const CATEGORIES=[
 "AUTH_TENANCY","FIRESTORE_READ_PATH","INPUT_VALIDATION",
 "CREDIT_SUBSCRIPTION","ERROR_HANDLING","CONTROL_FLOW",
 "RESPONSE_CONTRACT","OTHER_EXECUTABLE"
];
const TYPES=["VariableStatement","ExpressionStatement","IfStatement",
 "ReturnStatement","ThrowStatement","TryStatement","OtherStatement"];
const MAX_STATEMENTS=150;
function parse(src) {
 if(typeof src!=="string"||Buffer.byteLength(src)>1048576)throw new Error("SOURCE_INVALID");
 const file=ts.createSourceFile("in-memory.js",src,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 if(file.parseDiagnostics.length)throw new Error("PARSE_UNVERIFIABLE");
 return file;
}
function callbackStatements(src,name) {
 if(!NAMES.has(name))throw new Error("TARGET_UNSUPPORTED");
 const file=parse(src);
 const matches=[];
 for(const node of file.statements){
  if(!ts.isExpressionStatement(node)||!ts.isBinaryExpression(node.expression))continue;
  const assignment=node.expression;
  if(assignment.operatorToken.kind!==ts.SyntaxKind.EqualsToken)continue;
  const left=assignment.left;
  if(!ts.isPropertyAccessExpression(left)||
      !ts.isIdentifier(left.expression)||left.expression.text!=="exports"||
      left.name.text!==name)continue;
  if(!ts.isCallExpression(assignment.right)||assignment.right.arguments.length!==2)throw new Error("CALLABLE_UNVERIFIABLE");
  const fn=assignment.right.arguments[1];
  if(!ts.isArrowFunction(fn)&&!ts.isFunctionExpression(fn))throw new Error("CALLABLE_UNVERIFIABLE");
  if(!ts.isBlock(fn.body))throw new Error("BODY_UNVERIFIABLE");
  matches.push([...fn.body.statements]);
 }
 if(matches.length!==1)throw new Error("EXPORT_UNVERIFIABLE");
 if(matches[0].length>MAX_STATEMENTS)throw new Error("TOO_MANY_STATEMENTS");
 return {file,statements:matches[0]};
}
function tokens(node,file) {
 // Include both syntax kind and actual token text. Comments and formatting
 // omitted by skipTrivia scanner. Never print token text/digest.
 const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,node.getText(file));
 const h=crypto.createHash("sha256");
 for(;;){
  const kind=scanner.scan();
  if(kind===ts.SyntaxKind.EndOfFileToken)break;
  h.update(kind+"|"+scanner.getTokenText()+"\0");
 }
 return h.digest("hex");
}
function kind(node) {
 if(ts.isVariableStatement(node))return "VariableStatement";
 if(ts.isExpressionStatement(node))return "ExpressionStatement";
 if(ts.isIfStatement(node))return "IfStatement";
 if(ts.isReturnStatement(node))return "ReturnStatement";
 if(ts.isThrowStatement(node))return "ThrowStatement";
 if(ts.isTryStatement(node))return "TryStatement";
 return "OtherStatement";
}
const KEYWORDS={
 AUTH_TENANCY:new Set(["uid","ownerRef","ensureAccount","accountIdFor","auth","accounts","req"]),
 FIRESTORE_READ_PATH:new Set(["db","firestore","collection","doc","get","snap","ref","recordings","where","getAll"]),
 INPUT_VALIDATION:new Set(["validOp","validDevice","operationId","data","typeof","isSafeInteger"]),
 CREDIT_SUBSCRIPTION:new Set(["creditAvailable","pendingReservations","walletEnabled","subscriptionState","purchaseDecision","plan","used","reserved","limits","remaining","creditWalletRemaining","periodId","planExpiresAt"]),
 ERROR_HANDLING:new Set(["HttpsError","throw","catch","unauthenticated","permission-denied","failed-precondition","not-found","invalid-argument"]),
 RESPONSE_CONTRACT:new Set(["status","recordingId","barcode","file","plan","limit","used","reserved","remaining","subscriptionStatus","canBuyMore","purchaseReason"])
};
function categories(nodes) {
 const hit=new Set();
 const walk=(node)=>{
  if(ts.isIdentifier(node)){
   for(const [cat,words] of Object.entries(KEYWORDS))if(words.has(node.text))hit.add(cat);
  }
  if(ts.isStringLiteral(node)&&["unauthenticated","permission-denied","failed-precondition","not-found","invalid-argument"].includes(node.text))hit.add("ERROR_HANDLING");
  if(ts.isIfStatement(node)||ts.isConditionalExpression(node)||ts.isSwitchStatement(node)||ts.isTryStatement(node))hit.add("CONTROL_FLOW");
  if(ts.isThrowStatement(node))hit.add("ERROR_HANDLING");
  if(ts.isReturnStatement(node))hit.add("RESPONSE_CONTRACT");
  ts.forEachChild(node,walk);
 };
 for(const n of nodes)walk(n);
 if(hit.size===0)hit.add("OTHER_EXECUTABLE");
 return CATEGORIES.filter(x=>hit.has(x));
}
function sequenceDiff(a,b){
 // Whole-statement exact-token LCS, so inserting/removing a statement is not
 // incorrectly counted as modifications to all later statements.
 const n=a.length,m=b.length;
 const dp=Array.from({length:n+1},()=>Array(m+1).fill(0));
 for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--){
  dp[i][j]=a[i].fingerprint===b[j].fingerprint?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
 }
 const chunks=[];let i=0,j=0,removed=[],added=[];
 function flush(){if(removed.length||added.length){chunks.push({removed,added});removed=[];added=[];}}
 while(i<n||j<m){
  if(i<n&&j<m&&a[i].fingerprint===b[j].fingerprint){flush();i++;j++;}
  else if(j<m&&(i===n||dp[i][j+1]>dp[i+1][j])){added.push(b[j++]);}
  else if(i<n){removed.push(a[i++]);}
  else{added.push(b[j++]);}
 }
 flush();return chunks;
}
function inspect(review,deployed,name) {
 const a=callbackStatements(review,name),b=callbackStatements(deployed,name);
 const aa=a.statements.map(node=>({node,fingerprint:tokens(node,a.file),type:kind(node)}));
 const bb=b.statements.map(node=>({node,fingerprint:tokens(node,b.file),type:kind(node)}));
 const changes=sequenceDiff(aa,bb);
 const operations={MODIFIED:0,DEPLOYED_ONLY:0,REVIEW_ONLY:0};
 const types=Object.fromEntries(TYPES.map(k=>[k,0]));
 const cats=Object.fromEntries(CATEGORIES.map(k=>[k,0]));
 let unresolved=0;
 for(const block of changes){
  const removed=block.removed,added=block.added;
  // Non 1-to-1 blocks are ambiguous; count and mark unresolved.
  let op="MODIFIED";
  if(removed.length===0)op="DEPLOYED_ONLY";
  else if(added.length===0)op="REVIEW_ONLY";
  else if(removed.length!==1||added.length!==1)unresolved++;
  operations[op]++;
  const combined=[...removed,...added];
  for(const x of combined)types[x.type]++;
  const signals=categories(combined.map(x=>x.node));
  for(const c of signals)cats[c]++;
 }
 const changed=changes.length>0;
 const categoryCoverage=changes.length===0?"NO_DIFFERENCES":
    unresolved?"AMBIGUOUS_STATEMENT_ALIGNMENT":"HEURISTIC_SIGNALS_ONLY";
 return {name,status:changed?"DRIFT_REVIEW_REQUIRED":"EXACT_STATEMENT_TOKENS",
  operations,statementTypes:types,categories:cats,
  changedBlocks:changes.length,ambiguousBlocks:unresolved,
  categoryCoverage,
  conclusion:"FUNCTIONAL_EQUIVALENCE_NOT_PROVEN"};
}
function main(){
 try{
  const raw=fs.readFileSync(0,"utf8");
  if(Buffer.byteLength(raw)>2500000)throw new Error("INPUT_TOO_LARGE");
  const input=JSON.parse(raw);
  if(!input||!NAMES.has(input.name))throw new Error("INVALID_NAME");
  process.stdout.write(JSON.stringify(inspect(input.review,input.deployed,input.name))+"\n");
 }catch{
  process.stdout.write(JSON.stringify({error:"STATEMENT_REVIEW_NOT_VERIFIABLE"})+"\n");
  process.exitCode=2;
 }
}
if(require.main===module)main();
module.exports={inspect,callbackStatements,sequenceDiff};
