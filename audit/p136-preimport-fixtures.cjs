'use strict';
// P136 synthetic local module fixture; never imports code or uses cloud.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'p136-fixture-'));
const owner=['ownerGetCustomerAdjustmentHistory','ownerGetCustomerManageState','ownerGrantVideoCredits','ownerUpdateCustomerExpiry'];
const archive='e82154a69b8d8a569467766c497a22428844f953f08ddeb25aefcf7fb3441456';
try{
 const dir=path.join(root,'recovered');fs.mkdirSync(dir);
 const contents={
  'index.js':"const admin=require('firebase-admin');admin.initializeApp();\n"+
    owner.map(x=>"exports."+x+"=onCall(async req=>{return req.auth?.uid;});").join('\n'),
  'package.json':JSON.stringify({main:'index.js',scripts:{serve:'node test.js'}})
 };
 const m={archive_sha256:archive,files:[]};
 for(const [name,value]of Object.entries(contents)){const b=Buffer.from(value);fs.writeFileSync(path.join(dir,name),b);m.files.push({path:name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')})}
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(m));
 const exe=path.join(__dirname,'p136-recovered-module-preimport.cjs');
 function run(){return cp.spawnSync(process.execPath,[exe,root],{encoding:'utf8'})}
 let r=run();if(r.status!==0)throw Error(r.stdout+r.stderr);
 if(!r.stdout.includes('P136_EXPLICIT_OWNER_EXPORTS=4/4')||!r.stdout.includes('P136_ADMIN_INIT_CALLS=1')||!r.stdout.includes('P136_IMPORT_ALLOWED=NO'))throw Error(r.stdout);
 console.log('P136_MODULE_SIDE_EFFECT_INDICATORS=PASS');
 fs.appendFileSync(path.join(dir,'index.js'),'\n// TAMPER');
 r=run();if(r.status===0||!r.stdout.includes('P136_BLOCK=SOURCE_INTEGRITY_ERROR'))throw Error(r.stdout);
 console.log('P136_MANIFEST_TAMPER_BLOCK=PASS');
 fs.writeFileSync(path.join(dir,'index.js'),contents['index.js']);
 const bad=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));bad.files[0].path='../index.js';
 fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(bad));
 r=run();if(r.status===0||!r.stdout.includes('P136_BLOCK=MANIFEST_PATH_INVALID'))throw Error(r.stdout);
 console.log('P136_TRAVERSAL_BLOCK=PASS');
 console.log('P136_OFFLINE_FIXTURES=3/3_PASS');
}finally{fs.rmSync(root,{force:true,recursive:true})}
