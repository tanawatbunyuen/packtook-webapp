#!/usr/bin/env node
'use strict';
// P136: analyze recovered ZIP contents locally, never execute recovered code.
// Output only safe aggregate counts; audit interpretation is fail-closed.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const acorn=require('acorn');
const EXPECTED='e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456';
const NAMES=['ownerGetCustomerAdjustmentHistory','ownerGetCustomerManageState','ownerGrantVideoCredits','ownerUpdateCustomerExpiry'];
function error(reason){throw new Error(reason)}
function memberChain(node) {
 if(!node)return '';
 if(node.type==='Identifier')return node.name;
 if(node.type==='MemberExpression'&&!node.computed)return memberChain(node.object)+'.'+(node.property?.name||'?');
 return '';
}
function traverse(node,visit){
 if(!node||typeof node!=='object'||typeof node.type!=='string')return;
 visit(node);
 for(const [key,val] of Object.entries(node)){
  if(['start','end','loc'].includes(key))continue;
  if(Array.isArray(val)){for(const x of val)traverse(x,visit)}
  else if(val&&typeof val.type==='string')traverse(val,visit);
 }
}
function isFunction(node){return node&&['FunctionExpression','ArrowFunctionExpression','FunctionDeclaration'].includes(node.type)}
function topLevelCalls(ast){
 const calls=[];
 function scan(node){
  if(!node||typeof node!=='object'||typeof node.type!=='string')return;
  if(isFunction(node))return;
  if(node.type==='CallExpression'||node.type==='NewExpression')calls.push(memberChain(node.callee)||'UNRESOLVED');
  for(const [key,val] of Object.entries(node)){
   if(['start','end','loc'].includes(key))continue;
   if(Array.isArray(val)){for(const x of val)scan(x)}
   else if(val&&typeof val.type==='string')scan(val);
  }
 }
 for(const n of ast.body||[])scan(n);
 return calls;
}
function main(){
 const base=path.resolve(process.argv[2]||path.join(process.env.HOME||'', '.packtook-recovery','p128-owner-'+EXPECTED.slice(0,12)));
 const manifestPath=path.join(base,'manifest.json');
 const folder=path.join(base,'recovered');
 if(!fs.existsSync(manifestPath)||!fs.existsSync(folder))error('RECOVERY_MISSING');
 if(fs.lstatSync(base).isSymbolicLink()||fs.lstatSync(manifestPath).isSymbolicLink()||fs.lstatSync(folder).isSymbolicLink())error('RECOVERY_SYMLINK');
 const meta=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(meta.archive_sha256!==EXPECTED||!Array.isArray(meta.files)||meta.files.length===0||meta.files.length>1000)error('MANIFEST_INVALID');
 const entries=[],used=new Set();
 for(const f of meta.files){
  const rel=f?.path;
  if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.includes('\\')||rel.split('/').includes('..')||used.has(rel))error('MANIFEST_PATH_INVALID');
  used.add(rel);
  const filename=path.resolve(folder,rel);
  if(!filename.startsWith(folder+path.sep))error('MANIFEST_SCOPE_INVALID');
  const stat=fs.lstatSync(filename);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>4*1024*1024)error('SOURCE_FILE_INVALID');
  const data=fs.readFileSync(filename);
  if(crypto.createHash('sha256').update(data).digest('hex')!==f.sha256||data.length!==f.bytes)error('SOURCE_INTEGRITY_ERROR');
  entries.push({rel,data});
 }
 let files=0,parseFailed=0,topCalls=0,adminInit=0,secretDeclarations=0,externalRequires=0,topProcessEnv=0,dynamicEval=0;
 let packageCount=0,manifestScripts=0,mainField=0,exportsDefined=new Set();
 for(const {rel,data} of entries){
  if(path.posix.basename(rel)==='package.json'){
   packageCount++;
   try{
    const json=JSON.parse(data.toString('utf8'));
    if(typeof json.main==='string')mainField++;
    if(json.scripts&&typeof json.scripts==='object')manifestScripts+=Object.keys(json.scripts).length;
   }catch(_){error('PACKAGE_JSON_INVALID')}
  }
  if(!/\.(js|cjs|mjs)$/.test(rel)||rel.split('/').includes('node_modules'))continue;
  files++;
  let ast;
  try{ast=acorn.parse(data.toString('utf8'),{ecmaVersion:'latest',sourceType:'module'})}
  catch(_){try{ast=acorn.parse(data.toString('utf8'),{ecmaVersion:'latest',sourceType:'script'})}catch(_){parseFailed++;continue}}
  const calls=topLevelCalls(ast);
  topCalls+=calls.length;
  adminInit+=calls.filter(c=>c==='admin.initializeApp'||c==='initializeApp').length;
  secretDeclarations+=calls.filter(c=>c==='defineSecret').length;
  externalRequires+=calls.filter(c=>c==='require').length;
  traverse(ast,n=>{
   if(n.type==='CallExpression'){
    const name=memberChain(n.callee);
    if(['eval','Function'].includes(name))dynamicEval++;
   }
   if(n.type==='NewExpression'&&memberChain(n.callee)==='Function')dynamicEval++;
   if(n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&!n.left.computed&&memberChain(n.left.object)==='exports'&&NAMES.includes(n.left.property?.name))exportsDefined.add(n.left.property.name);
  });
  for(const n of ast.body||[]){
   if(isFunction(n))continue;
   traverse(n,k=>{if(k.type==='MemberExpression'&&memberChain(k)==='process.env')topProcessEnv++});
  }
 }
 console.log('P136_MODE=LOCAL_ONLY_STATIC_PREIMPORT');
 console.log('P136_VERIFIED_ARCHIVE_SHA256=TRUE P136_MANIFEST_FILES='+entries.length);
 console.log('P136_JS_FILES='+files+' P136_PARSE_FAILURES='+parseFailed);
 console.log('P136_PACKAGE_JSON_FILES='+packageCount+' P136_PACKAGE_MAIN_FIELDS='+mainField+' P136_PACKAGE_SCRIPT_ENTRIES='+manifestScripts);
 console.log('P136_TOP_LEVEL_CALLS='+topCalls+' P136_TOP_LEVEL_REQUIRE_CALLS='+externalRequires+' P136_ADMIN_INIT_CALLS='+adminInit+' P136_DEFINE_SECRET_CALLS='+secretDeclarations);
 console.log('P136_TOP_SCOPE_PROCESS_ENV_REFERENCES='+topProcessEnv+' P136_DYNAMIC_EVAL_INDICATORS='+dynamicEval);
 console.log('P136_EXPLICIT_OWNER_EXPORTS='+exportsDefined.size+'/4');
 console.log('P136_IMPORT_SIDE_EFFECT_SAFETY=UNVERIFIED P136_IMPORT_ALLOWED=NO');
 console.log('P136_EMULATOR_REAL_HANDLER_ALLOWED=NO P136_DEPLOY_ALLOWED=NO');
 console.log('P136_SOURCE_EXECUTION=0 P136_CLOUD_CALLS=0 P136_REPOSITORY_WRITES=0');
 console.log('P136_DECISION=NO_GO_MANUAL_MODULE_INITIALIZATION_AND_AUTHZ_REVIEW');
 if(parseFailed||exportsDefined.size!==4)process.exitCode=1;
}
try{main()}catch(e){console.log('P136_BLOCK='+String(e.message||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'_').slice(0,80));process.exitCode=1}
