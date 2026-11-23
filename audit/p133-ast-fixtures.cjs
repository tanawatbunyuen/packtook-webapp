'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'p133-fixture-'));
const names=['ownerGetCustomerAdjustmentHistory','ownerGetCustomerManageState','ownerGrantVideoCredits','ownerUpdateCustomerExpiry'];
const expected='e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456';
try{
 fs.mkdirSync(path.join(root,'recovered'));
 const js="function requireOwner(req){if(!req.auth)throw new HttpsError('unauthenticated');return req.auth.uid;}\n"+
 names.map(n=>"exports."+n+"=onCall(async req=>{return requireOwner(req)});").join('\n');
 const bytes=Buffer.from(js),digest=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(path.join(root,'recovered','index.js'),bytes);
 const manifest={archive_sha256:expected,files:[{path:'index.js',bytes:bytes.length,sha256:digest}]};
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));
 const program=path.join(__dirname,'p133-owner-authz-ast.cjs');
 function run(){return cp.spawnSync(process.execPath,[program,root],{encoding:'utf8'})}
 let r=run(); if(r.status!==0)throw Error(r.stdout+r.stderr);
 if(!r.stdout.includes('P133_JS_FILES_PARSED=1 P133_JS_PARSE_FAILURES=0'))throw Error(r.stdout);
 if(!r.stdout.includes('P133_FUNCTION=ownerGrantVideoCredits EXPORTS=1'))throw Error(r.stdout);
 if(!r.stdout.includes('INDIRECT_AUTH_HELPERS=1'))throw Error(r.stdout);
 console.log('P133_SYNTHETIC_HELPER_AST=PASS');
 const modified=Buffer.from(js+'// mutation');
 fs.writeFileSync(path.join(root,'recovered','index.js'),modified);
 r=run();if(r.status===0||!r.stdout.includes('P133_BLOCK=MANIFEST_INTEGRITY_FAIL'))throw Error(r.stdout);
 console.log('P133_MANIFEST_INTEGRITY_BLOCK=PASS');
 console.log('P133_OFFLINE_FIXTURES=2/2_PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
