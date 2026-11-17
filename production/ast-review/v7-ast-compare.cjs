"use strict";
/* V7 offline AST extraction. Consumes private sources only through stdin.
 * No source, token, identifier names, syntax diagnostics or digests in stdout.
 * TypeScript 5.9.3 parser. Static structural signals, NEVER equivalence proof.
 */
const fs = require("node:fs");
const ts = require("typescript");
const crypto = require("node:crypto");

const NAMES = new Set(["reserveCredit","finalizeCredit","recordingStatus",
  "recoverStaleVideoReservation","usageStatus"]);
const HELPERS = new Set(["uid","ownerRef","ensureAccount","accountIdFor",
  "creditAvailable","walletEnabled","pendingReservations","subscriptionState",
  "purchaseDecision","barcodeKey","validOp","validDevice"]);
const SCOPES = ["SELECTED_HANDLER","CRITICAL_HELPER","OTHER_EXPORTED_FUNCTION",
  "OTHER_TOP_LEVEL_FUNCTION","TOP_LEVEL_BINDING","UNATTRIBUTED_STATEMENT"];

function sourceNodes(code) {
  if (typeof code !== "string" || Buffer.byteLength(code)>1048576) throw new Error("BAD_SOURCE");
  const sf=ts.createSourceFile("in-memory.js",code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  if (sf.parseDiagnostics.length>0) throw new Error("PARSE_NOT_VERIFIABLE");
  const out=new Map();
  let unhandled=0;
  function add(key,scope,node) {
    if(out.has(key)) throw new Error("DUPLICATE_DECLARATION");
    const scanner=ts.createScanner(ts.ScriptTarget.Latest,true,ts.LanguageVariant.Standard,node.getText(sf));
    const h=crypto.createHash("sha256");
    while(true) {
      const kind=scanner.scan();
      if(kind===ts.SyntaxKind.EndOfFileToken) break;
      h.update(String(kind)+"|"+scanner.getTokenText()+"\0");
    }
    out.set(key,{scope,digest:h.digest("hex")});
  }
  for (const node of sf.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name=node.name.text;
      add("f:"+name,HELPERS.has(name)?"CRITICAL_HELPER":"OTHER_TOP_LEVEL_FUNCTION",node);
    } else if(ts.isVariableStatement(node) && node.declarationList.declarations.length===1 &&
       ts.isIdentifier(node.declarationList.declarations[0].name)) {
      const name=node.declarationList.declarations[0].name.text;
      add("v:"+name,"TOP_LEVEL_BINDING",node);
    } else if(ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind===ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.expression.left) &&
        ts.isIdentifier(node.expression.left.expression) &&
        node.expression.left.expression.text==="exports") {
      const name=node.expression.left.name.text;
      add("e:"+name,NAMES.has(name)?"SELECTED_HANDLER":"OTHER_EXPORTED_FUNCTION",node);
    } else {
      // Unrecognized statements must NEVER silently disappear.
      unhandled++;
      add("unattributed:"+unhandled,"UNATTRIBUTED_STATEMENT",node);
    }
  }
  return out;
}
function compare(a,b,selected) {
  const left=sourceNodes(a),right=sourceNodes(b);
  const counts={};
  for(const scope of SCOPES)counts[scope]={MODIFIED:0,DEPLOYED_ONLY:0,REVIEW_ONLY:0};
  const current={MODIFIED:0,DEPLOYED_ONLY:0,REVIEW_ONLY:0};
  const other={MODIFIED:0,DEPLOYED_ONLY:0,REVIEW_ONLY:0};
  for(const key of new Set([...left.keys(),...right.keys()])) {
    const x=left.get(key),y=right.get(key);
    if(x&&y&&x.digest===y.digest)continue;
    // A scope reclassification is an unresolved change; count both sides.
    if(x&&y&&x.scope!==y.scope) {
      counts[x.scope].REVIEW_ONLY++;
      counts[y.scope].DEPLOYED_ONLY++;
    } else {
      const scope=(x||y).scope;
      const op=!x?"DEPLOYED_ONLY":!y?"REVIEW_ONLY":"MODIFIED";
      counts[scope][op]++;
      if(scope==="SELECTED_HANDLER") (key==="e:"+selected?current:other)[op]++;
    }
  }
  const k="e:"+selected, aHandler=left.get(k), bHandler=right.get(k);
  const handler=(!aHandler||!bHandler)?"NOT_VERIFIABLE":aHandler.digest===bHandler.digest?"EXACT_AST_TOKENS":"DRIFT_AST_TOKENS";
  return {handler,counts,selectedCurrent:current,selectedOther:other,ast:"TYPESCRIPT_STATIC_TOKEN_AST_NO_RUNTIME_PROOF"};
}
function execute(input) {
  if(!input || !NAMES.has(input.name)) throw new Error("INVALID_FUNCTION");
  return compare(input.review,input.deployed,input.name);
}
function main() {
  try {
    const buf=fs.readFileSync(0,"utf8");
    if(Buffer.byteLength(buf)>2500000) throw new Error("INPUT_TOO_LARGE");
    const out=execute(JSON.parse(buf));
    process.stdout.write(JSON.stringify(out)+"\n");
  } catch {
    process.stdout.write(JSON.stringify({error:"AST_NOT_VERIFIABLE"})+"\n");
    process.exitCode=2;
  }
}
if(require.main===module)main();
module.exports={sourceNodes,compare,execute};
