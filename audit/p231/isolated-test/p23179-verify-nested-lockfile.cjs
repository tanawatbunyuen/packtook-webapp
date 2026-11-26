'use strict';
// P231.79 read-only lockfile check for arbitrarily nested npm node_modules paths.
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const base=__dirname;
const pkg=JSON.parse(fs.readFileSync(path.join(base,'package.json'),'utf8'));
const raw=fs.readFileSync(path.join(base,'package-lock.json'));
const lock=JSON.parse(raw);
let ok=true;
const check=(name,result)=>{
  console.log('P231_'+name+'='+(result?'PASS':'FAIL'));
  if(!result)ok=false;
};
console.log('P231_CHECK=NESTED_DEPENDENCY_LOCKFILE_VERIFICATION');
check('NODE22',process.versions.node.split('.')[0]==='22');
check('LOCKFILE_VERSION_3',lock.lockfileVersion===3);
const expected={
  '@firebase/database':'1.1.5',
  '@firebase/database-compat':'2.1.7'
};
for(const [name,version] of Object.entries(expected)){
  check('OVERRIDE_'+name.replace(/[^A-Za-z0-9]/g,'_').toUpperCase(),pkg.overrides?.[name]===version);
  // npm lock v3 stores installed package paths: they can be nested.
  const entries=Object.entries(lock.packages||{}).filter(([loc])=>loc.endsWith('/node_modules/'+name)||loc==='node_modules/'+name);
  console.log('P231_'+name.replace(/[^A-Za-z0-9]/g,'_').toUpperCase()+'_COUNT='+entries.length);
  check('LOCKED_'+name.replace(/[^A-Za-z0-9]/g,'_').toUpperCase(),entries.length>0&&entries.every(([,record])=>record.version===version));
  for(const [loc,record] of entries){
    console.log('P231_PACKAGE_PATH='+loc);
    console.log('P231_PACKAGE_VERSION='+record.version);
  }
}
check('LOCK_ROOT_NAME',lock.name===pkg.name);
check('LOCK_ROOT_DEPENDENCY',lock.packages?.['']?.dependencies?.['firebase-functions']===pkg.dependencies?.['firebase-functions']);
console.log('P231_LOCKFILE_SHA256='+crypto.createHash('sha256').update(raw).digest('hex'));
console.log('P231_LOCKFILE_PACKAGE_COUNT='+Object.keys(lock.packages||{}).length);
console.log('P231_VERSION_PIN='+(ok?'PASS':'FAIL'));
console.log('P231_GITHUB_WRITES=0');
console.log('P231_CLOUD_WRITES=0');
console.log('P231_DEPLOY=NOT_PERFORMED');
console.log('P231_RUNTIME_APPCHECK=NOT_VERIFIED');
console.log('P231_RELEASE=NO_GO');
if(!ok)process.exitCode=1;
