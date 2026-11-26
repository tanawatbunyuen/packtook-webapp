'use strict';
// Static package/deployment preflight. No network access, no cloud writes.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const dir=__dirname;
const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
const source=fs.readFileSync(path.join(dir,'index.js'),'utf8');
const must=(ok,name)=>{console.log('P231_'+name+'='+(ok?'PASS':'FAIL'));if(!ok)process.exitCode=1;};

console.log('P231_CHECK=ISOLATED_DEPLOYMENT_PACKAGE_STATIC_PREFLIGHT');
must(pkg.private===true&&pkg.main==='index.js'&&pkg.engines?.node==='22','MANIFEST_BASIC');
must(Object.keys(pkg.dependencies||{}).length===1&&Object.hasOwn(pkg.dependencies,'firebase-functions'),'DEPENDENCIES_MINIMAL');
must(!Object.hasOwn(pkg.dependencies,'firebase-admin'),'NO_ADMIN_DEPENDENCY');
must(source.includes("invoker:'private'"),'PRIVATE_INVOKER_DECLARED');
must(source.includes("serviceAccount:'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com'"),'DEDICATED_RUNTIME_DECLARED');
must(source.includes('enforceAppCheck:true'),'APPCHECK_ENFORCEMENT_DECLARED');
must(!/require\(['"]firebase-admin/.test(source),'NO_FIREBASE_ADMIN_IMPORT');
must(!/\.collection\(|\.doc\(|omise|chargeCredit|recordingStatus|usageStatus|accountRole/i.test(source),'NO_LIVE_DATA_OPERATIONS');
must(!fs.existsSync(path.join(dir,'firebase.json')),'NO_MISLEADING_NESTED_FIREBASE_CONFIG');
must(fs.existsSync(path.join(dir,'package-lock.json')),'REPRODUCIBLE_DEPENDENCY_LOCKFILE');
console.log('P231_PACKAGE_PREFLIGHT_WRITES=0');
console.log('P231_DEPLOY=NOT_PERFORMED');
console.log('P231_RUNTIME_APPCHECK=NOT_VERIFIED');
console.log('P231_RELEASE=NO_GO');
