'use strict';
// P135 evidence gate. Offline only; never treats static indicators as auth proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'p135-operator-p134-evidence.json'),'utf8'));
const four=['ownerGetCustomerAdjustmentHistory','ownerGetCustomerManageState','ownerGrantVideoCredits','ownerUpdateCustomerExpiry'];
const checks=[];
function check(s,v){checks.push({s,v});console.log((v?'PASS ':'BLOCK ')+s)}
check('STAGING_SOURCE_EVIDENCE',data.project==='packtook-staging'&&data.phase==='P134_REAL_LOCAL_STATIC_AST');
check('EXACT_FOUR_OWNER_FUNCTIONS',JSON.stringify(Object.keys(data.functions))===JSON.stringify(four));
check('SOURCE_INTEGRITY_BASELINE',data.recovered_files===6&&data.parsed_js_files===3);
check('AUTH_SIGNALS_NOT_TREATED_AS_PROOF',four.every(k=>data.functions[k].guard_before_mutation_proven===false));
check('MUTATORS_IDENTIFIED',four.slice(2).every(k=>data.functions[k].direct_mutation_calls===4&&data.functions[k].helper_mutation_candidates===1));
check('NO_ROLE_INDICATORS',four.every(k=>data.functions[k].owner_role_indicators===0));
check('NO_APPCHECK_INDICATORS',four.every(k=>data.functions[k].appcheck_indicators===0));
check('SOURCE_PARITY_NOT_ATTESTED',data.source_to_deploy_parity_attested===false);
for(const name of four){
 const d=data.functions[name];
 console.log('P135_OWNER='+name+' MANUAL_AUTHZ_REVIEW=REQUIRED TENANT_ISOLATION_REVIEW=REQUIRED APPCHECK_REVIEW=REQUIRED');
 if(d.direct_mutation_calls+d.helper_mutation_candidates>0)
   console.log('P135_OWNER='+name+' WRITE_GUARD_DOMINANCE=UNVERIFIED IDEMPOTENCY=UNVERIFIED CREDIT_OR_EXPIRY_INVARIANTS=UNVERIFIED');
}
console.log('P135_CHECKS='+checks.filter(x=>x.v).length+'/'+checks.length);
console.log('P135_DECISION=NO_GO_OWNER_AUTHZ_AND_WRITE_GUARDS_UNVERIFIED');
console.log('P135_CLOUD_CALLS=0 P135_GIT_WRITES=0 P135_DEPLOYS=0');
if(checks.some(x=>!x.v))process.exitCode=1;
