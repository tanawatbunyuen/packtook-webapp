#!/usr/bin/env node
'use strict';
// P133: Acorn AST evidence triage only. No source execution, upload or cloud calls.
// Never prints source text, snippets, file paths, dynamic values, or credentials.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const acorn=require('acorn');
const expectedHash='e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456';
const names=['ownerGetCustomerAdjustmentHistory','ownerGetCustomerManageState','ownerGrantVideoCredits','ownerUpdateCustomerExpiry'];
function fail(msg){throw Error(msg)}
function hash(x){return crypto.createHash('sha256').update(x).digest('hex')}
function walk(n,visit){if(!n||typeof n!=='object')return;if(typeof n.type==='string')visit(n);for(const [k,v] of Object.entries(n)){if(k==='parent'||k==='loc'||k==='start'||k==='end')continue;if(Array.isArray(v)){for(const t of v)if(t&&typeof t.type==='string')walk(t,visit)}else if(v&&typeof v.type==='string')walk(v,visit)}}
function memberString(n){if(n?.type!=='MemberExpression'||n.computed)return null;return n.object?.type==='Identifier'&&n.property?.type==='Identifier'?n.object.name+'.'+n.property.name:null}
function called(n){const c=n.callee;if(c?.type==='Identifier')return c.name;return null}
function analyze(ast){
const helpers=new Map(),handlers=new Map();
walk(ast,n=>{
 if(n.type==='FunctionDeclaration'&&n.id?.name)helpers.set(n.id.name,n);
 if(n.type==='VariableDeclarator'&&n.id?.type==='Identifier'&&['ArrowFunctionExpression','FunctionExpression'].includes(n.init?.type))helpers.set(n.id.name,n.init);
 if(n.type==='AssignmentExpression'&&n.operator==='='&&memberString(n.left)?.startsWith('exports.')){
   const name=memberString(n.left).slice(8);
   if(names.includes(name)){if(!handlers.has(name))handlers.set(name,[]);handlers.get(name).push(n.right)}
 }
});
function inspect(n){
 const visited=new Set();let calls=new Set(),auth=false,deny=false,appcheck=false;
 walk(n,x=>{
  if(x.type==='MemberExpression'&&['req.auth','request.auth','context.auth'].includes(memberString(x)))auth=true;
  if(x.type==='Identifier'&&['enforceAppCheck','appCheck'].includes(x.name))appcheck=true;
  if(x.type==='Literal'&&typeof x.value==='string'&&['unauthenticated','permission-denied'].includes(x.value))deny=true;
  if(x.type==='CallExpression'){const c=called(x);if(c)calls.add(c)}
 });
 return {calls,auth,deny,appcheck};
}
const records=[];
for(const name of names){
 const defs=handlers.get(name)||[];
 let roots=[],immediate=new Set();
 for(const expr of defs){
  if(expr?.type==='CallExpression'){for(const a of expr.arguments)if(['ArrowFunctionExpression','FunctionExpression'].includes(a.type))roots.push(a)}
  else roots.push(expr);
 }
 let direct={calls:new Set(),auth:false,deny:false,appcheck:false};
 for(const r of roots){const a=inspect(r);for(const c of a.calls)direct.calls.add(c);direct.auth ||=a.auth;direct.deny ||=a.deny;direct.appcheck ||=a.appcheck}
 const queue=[...direct.calls],helperSeen=new Set();let authHelpers=0,denyHelpers=0,indirectAppcheck=0;
 while(queue.length&&helperSeen.size<100){
  const c=queue.shift();if(helperSeen.has(c)||!helpers.has(c))continue;
  helperSeen.add(c);
  const x=inspect(helpers.get(c));authHelpers+=Number(x.auth);denyHelpers+=Number(x.deny);indirectAppcheck+=Number(x.appcheck);
  for(const next of x.calls)if(!helperSeen.has(next))queue.push(next);
 }
 records.push({name,exports:defs.length,roots:roots.length,directAuth:direct.auth,directDeny:direct.deny,
   directAppcheck:direct.appcheck,reachableHelpers:helperSeen.size,authHelpers,denyHelpers,appcheckHelpers:indirectAppcheck});
}
return records;
}
function main(){
 const recovery=process.argv[2]||path.join(process.env.HOME||'', '.packtook-recovery','p128-owner-'+expectedHash.slice(0,12));
 const base=path.resolve(recovery),folder=path.join(base,'recovered'),manifestPath=path.join(base,'manifest.json');
 if(!fs.existsSync(manifestPath)||!fs.statSync(base).isDirectory())fail('RECOVERY_MISSING');
 if(fs.lstatSync(manifestPath).isSymbolicLink()||fs.lstatSync(folder).isSymbolicLink())fail('RECOVERY_SYMLINK');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(manifest.archive_sha256!==expectedHash)fail('RECOVERY_ARCHIVE_HASH_MISMATCH');
 if(!Array.isArray(manifest.files)||manifest.files.length>1000)fail('INVALID_MANIFEST');
 const sources=[];
 for(const item of manifest.files){
  const relative=item.path;
  if(typeof relative!=='string'||!relative||relative.startsWith('/')||relative.includes('..')||relative.includes('\\'))fail('UNSAFE_MANIFEST_PATH');
  const absolute=path.resolve(folder,relative);
  if(!absolute.startsWith(folder+path.sep))fail('UNSAFE_RESOLVED_PATH');
  const st=fs.lstatSync(absolute);
  if(!st.isFile()||st.isSymbolicLink()||st.size>4*1024*1024)fail('SOURCE_FILE_INVALID');
  const data=fs.readFileSync(absolute);
  if(hash(data)!==item.sha256||data.length!==item.bytes)fail('MANIFEST_INTEGRITY_FAIL');
  if(/\.(js|cjs|mjs)$/.test(relative)&&!relative.split('/').includes('node_modules'))sources.push(data.toString('utf8'));
 }
 if(!sources.length)fail('NO_JS_FILES');
 const all=names.map(n=>({name:n,exports:0,roots:0,directAuth:false,directDeny:false,directAppcheck:false,reachableHelpers:0,authHelpers:0,denyHelpers:0,appcheckHelpers:0}));
 let parseFailures=0,parsed=0;
 for(const s of sources){
  let ast;
  try{ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'unambiguous'});}
  catch(_){try{ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'module'});}catch(_){try{ast=acorn.parse(s,{ecmaVersion:'latest',sourceType:'script'});}catch(_){parseFailures++;continue}}}
  parsed++;
  const found=analyze(ast);
  for(let i=0;i<names.length;i++){const a=all[i],b=found[i];for(const key of Object.keys(a)){if(key==='name')continue;if(typeof a[key]==='number')a[key]+=b[key];else a[key] ||=b[key]}}
 }
 console.log('P133_MODE=LOCAL_ACORN_AST_ONLY');
 console.log('P133_JS_FILES_PARSED='+parsed+' P133_JS_PARSE_FAILURES='+parseFailures);
 for(const r of all){
  const p='P133_FUNCTION='+r.name+' ';
  console.log(p+'EXPORTS='+r.exports+' HANDLER_ROOTS='+r.roots+' REACHABLE_LOCAL_HELPERS='+r.reachableHelpers);
  console.log(p+'DIRECT_AUTH_AST='+String(r.directAuth).toUpperCase()+' DIRECT_DENY_AST='+String(r.directDeny).toUpperCase()+
   ' INDIRECT_AUTH_HELPERS='+r.authHelpers+' INDIRECT_DENY_HELPERS='+r.denyHelpers+' APPCHECK_INDICATORS='+Number(r.directAppcheck||r.appcheckHelpers>0));
  console.log(p+'AUTHORIZATION_PROVEN=NO');
 }
 console.log('P133_LIMITATIONS=STATIC_AST_NOT_RUNTIME_OR_CONTROL_FLOW_PROOF');
 console.log('P133_DECISION=NO_GO_MANUAL_AUTHZ_REVIEW_REQUIRED');
 console.log('P133_GIT_WRITES=0 P133_CLOUD_CALLS=0 P133_SOURCE_EXECUTION=0 P133_DEPLOYS=0');
 if(parseFailures||all.some(r=>r.exports!==1||r.roots<1))process.exitCode=1;
}
try{main()}catch(e){console.log('P133_BLOCK='+String(e.message||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'_').slice(0,60));process.exitCode=1}
