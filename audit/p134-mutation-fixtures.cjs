'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'p134-'));
const names=['ownerGetCustomerAdjustmentHistory','ownerGetCustomerManageState','ownerGrantVideoCredits','ownerUpdateCustomerExpiry'];
const expected='e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456';
try{
 fs.mkdirSync(path.join(root,'recovered'));
 const js="function requireAdmin(req){if(!req.auth)throw new HttpsError('permission-denied'); return req.auth.uid;}\n"+
 "function writeCredits(req){requireAdmin(req);return db.collection('accounts').doc(req.auth.uid).update({credits:5});}\n"+
 names.map(n=>"exports."+n+"=onCall(async req=>{return writeCredits(req)});").join('\n');
 const bytes=Buffer.from(js),digest=crypto.createHash('sha256').update(bytes).digest('hex');
 fs.writeFileSync(path.join(root,'recovered','index.js'),bytes);
 const manifest={archive_sha256:expected,files:[{path:'index.js',bytes:bytes.length,sha256:digest}]};
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest));
 const program=path.join(__dirname,'p134-owner-mutation-guard.cjs');
 const run=()=>cp.spawnSync(process.execPath,[program,root],{encoding:'utf8'});
 let r=run();if(r.status!==0)throw Error(r.stdout+r.stderr);
 if(!r.stdout.includes('P134_PARSED_JS_FILES=1')||!r.stdout.includes('GUARD_BEFORE_MUTATION_PROVEN=NO')||!r.stdout.includes('HELPER_MUTATION_CANDIDATES=1'))throw Error(r.stdout);
 console.log('P134_SYNTHETIC_MUTATION_AND_GUARD_CANDIDATES=PASS');
 fs.writeFileSync(path.join(root,'recovered','index.js'),Buffer.from(js+'\n// tamper'));
 r=run();if(r.status===0||!r.stdout.includes('P134_BLOCK=MANIFEST_HASH_MISMATCH'))throw Error(r.stdout);
 console.log('P134_INTEGRITY_FAIL_CLOSED=PASS');
 console.log('P134_OFFLINE_FIXTURES=2/2_PASS');
}finally{fs.rmSync(root,{recursive:true,force:true})}
