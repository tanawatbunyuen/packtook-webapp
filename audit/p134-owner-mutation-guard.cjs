#!/usr/bin/env node
'use strict';
// P134: safe, conservative read-only AST triage for Owner mutation handler paths.
// Not a proof of authorization, control-flow dominance, or source-to-cloud parity.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),acorn=require('acorn');
const DIGEST='e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456';
const NAMES=['ownerGetCustomerAdjustmentHistory','ownerGetCustomerManageState','ownerGrantVideoCredits','ownerUpdateCustomerExpiry'];
function walk(n,fn){if(!n||typeof n!=='object')return;if(typeof n.type==='string')fn(n);for(const [key,value]of Object.entries(n)){if(['loc','start','end'].includes(key))continue;if(Array.isArray(value))for(const child of value)if(child?.type)walk(child,fn);else if(value?.type)walk(value,fn)}}
function traverse(n,fn){if(!n||typeof n!=='object')return;if(n.type)fn(n);for(const [key,value]of Object.entries(n)){if(['loc','start','end'].includes(key))continue;if(Array.isArray(value)){for(const child of value){if(child?.type)traverse(child,fn)}}else if(value?.type)traverse(value,fn)}}
function callName(node){const c=node?.callee;if(c?.type==='Identifier')return c.name;if(c?.type==='MemberExpression'&&!c.computed&&c.property?.type==='Identifier')return c.property.name;return null}
function exported(node){if(node?.type!=='AssignmentExpression'||node.operator!=='=')return null;const l=node.left;if(l?.type==='MemberExpression'&&!l.computed&&l.object?.name==='exports'&&l.property?.type==='Identifier')return l.property.name;return null}
function parseSources(dir){
 const meta=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 if(meta.archive_sha256!==DIGEST||!Array.isArray(meta.files)||meta.files.length>1000)throw Error('RECOVERY_MANIFEST_INVALID');
 const root=path.join(dir,'recovered'),asts=[];let count=0,total=0;const seen=new Set();
 if(fs.lstatSync(root).isSymbolicLink())throw Error('SOURCE_DIRECTORY_SYMLINK');
 for(const e of meta.files){
  const rel=e?.path;
  if(typeof rel!=='string'||!rel||rel.startsWith('/')||rel.includes('\\')||rel.split('/').includes('..')||seen.has(rel))throw Error('UNSAFE_MANIFEST_ENTRY');
  seen.add(rel);
  const fp=path.resolve(root,rel);if(!fp.startsWith(root+path.sep))throw Error('OUTSIDE_SOURCE_DIRECTORY');
  const st=fs.lstatSync(fp);if(!st.isFile()||st.isSymbolicLink()||st.size>4*1024*1024)throw Error('INVALID_SOURCE_FILE');
  total+=st.size;if(total>30*1024*1024)throw Error('RECOVERY_OVERSIZE');
  const data=fs.readFileSync(fp),sha=crypto.createHash('sha256').update(data).digest('hex');
  if(sha!==e.sha256||data.length!==e.bytes)throw Error('MANIFEST_HASH_MISMATCH');
  count++;
  if(!/\.(js|cjs|mjs)$/.test(rel)||rel.split('/').includes('node_modules'))continue;
  const text=data.toString('utf8');let ast;
  try{ast=acorn.parse(text,{ecmaVersion:'latest',sourceType:'module'})}
  catch(_){try{ast=acorn.parse(text,{ecmaVersion:'latest',sourceType:'script'})}catch(_){throw Error('JS_PARSE_FAILED')}}
  asts.push(ast);
 }
 return {asts,count};
}
function collect(asts){
 const helpers=new Map(),exports=new Map();
 for(const ast of asts)traverse(ast,node=>{
  if(node.type==='FunctionDeclaration'&&node.id?.name){if(!helpers.has(node.id.name))helpers.set(node.id.name,[]);helpers.get(node.id.name).push(node)}
  if(node.type==='VariableDeclarator'&&node.id?.type==='Identifier'&&['ArrowFunctionExpression','FunctionExpression'].includes(node.init?.type)){if(!helpers.has(node.id.name))helpers.set(node.id.name,[]);helpers.get(node.id.name).push(node.init)}
  const ex=exported(node);if(ex&&NAMES.includes(ex)){if(!exports.has(ex))exports.set(ex,[]);exports.get(ex).push(node.right)}
 });
 return {helpers,exports};
}
function describe(n){
 let mutation=0,auth=0,deny=0,role=0,appcheck=0,calls=new Set();
 traverse(n,x=>{
  if(x.type==='CallExpression'){
   const cn=callName(x);if(cn)calls.add(cn);
   if(['update','set','create','delete','add','runTransaction','batch','commit'].includes(cn))mutation++;
  }
  if(x.type==='MemberExpression'&&!x.computed&&x.property?.name==='auth')auth++;
  if(x.type==='Literal'&&['unauthenticated','permission-denied'].includes(x.value))deny++;
  if(x.type==='Identifier'&&/^(assertAdmin|requireAdmin|requireOwner|assertOwner|isAdmin)$/.test(x.name))role++;
  if(x.type==='Identifier'&&['enforceAppCheck','appCheck'].includes(x.name))appcheck++;
 });
 return {mutation,auth,deny,role,appcheck,calls};
}
function rootFn(exp){
 if(exp?.type==='CallExpression'){
  const arg=exp.arguments?.find(x=>['ArrowFunctionExpression','FunctionExpression'].includes(x?.type));
  if(arg)return arg;
 }
 return exp;
}
function main(){
 const d=path.resolve(process.argv[2]||path.join(process.env.HOME||'', '.packtook-recovery','p128-owner-'+DIGEST.slice(0,12)));
 const {asts,count}=parseSources(d);const {helpers,exports}=collect(asts);
 console.log('P134_MODE=LOCAL_AST_MUTATION_GUARD_TRIAGE');
 console.log('P134_RECOVERED_FILE_COUNT='+count+' P134_PARSED_JS_FILES='+asts.length);
 for(const name of NAMES){
  const defs=exports.get(name)||[];
  if(defs.length!==1){console.log('P134_FUNCTION='+name+' EXPORT_COUNT='+defs.length+' REVIEW=UNRESOLVED');process.exitCode=1;continue}
  const r=rootFn(defs[0]),direct=describe(r);
  const queue=[...direct.calls],seen=new Set(),help={mutation:0,auth:0,deny:0,role:0,appcheck:0};
  let ambiguous=0;
  while(queue.length&&seen.size<200){
   const n=queue.shift();if(seen.has(n))continue;seen.add(n);
   const candidates=helpers.get(n)||[];if(candidates.length>1)ambiguous++;
   for(const h of candidates){
    const s=describe(h);
    for(const key of Object.keys(help))help[key]+=s[key];
    for(const c of s.calls)if(!seen.has(c))queue.push(c);
   }
  }
  console.log('P134_FUNCTION='+name+' EXPLICIT_EXPORT=TRUE');
  console.log('P134_FUNCTION='+name+' DIRECT_MUTATION_CALLS='+direct.mutation+' HELPER_MUTATION_CANDIDATES='+help.mutation+' REACHABLE_HELPER_NAMES='+seen.size);
  console.log('P134_FUNCTION='+name+' AUTH_INDICATORS='+Number(direct.auth+help.auth)+' DENY_INDICATORS='+Number(direct.deny+help.deny)+' OWNER_ROLE_INDICATORS='+Number(direct.role+help.role)+' APPCHECK_INDICATORS='+Number(direct.appcheck+help.appcheck));
  console.log('P134_FUNCTION='+name+' AMBIGUOUS_HELPER_DEFINITIONS='+ambiguous+' GUARD_BEFORE_MUTATION_PROVEN=NO');
 }
 console.log('P134_SOURCE_TO_DEPLOY_PARITY=NOT_ATTESTED');
 console.log('P134_DECISION=NO_GO_MANUAL_AUTHZ_AND_MUTATION_REVIEW');
 console.log('P134_CLOUD_CALLS=0 P134_GIT_WRITES=0 P134_SOURCE_EXECUTION=0 P134_DEPLOYS=0');
}
try{main()}catch(e){console.log('P134_BLOCK='+String(e.message||'UNKNOWN').replace(/[^A-Z0-9_]/gi,'_').slice(0,50));process.exitCode=1}
