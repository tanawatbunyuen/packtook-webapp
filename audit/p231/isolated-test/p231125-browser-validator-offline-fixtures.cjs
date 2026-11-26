'use strict';
// P231.125 offline test of exactly the browser-script token-result classifier.
// No browser, Firebase API, network access, IAM, deploy, credentials, or tokens.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const script=fs.readFileSync(path.join(__dirname,'p231123-browser-appcheck-attestation-console.js'),'utf8');
console.log('P231_CHECK=BROWSER_TOKEN_VALIDATOR_OFFLINE_FIXTURES');
assert(script.includes('today !== "2026-11-26"'),'Approved date guard missing');
assert(script.includes('BLOCKED_DEBUG_TOKEN_PRESENT'),'Debug token guard missing');
assert(script.includes('https://packtook-staging.web.app'),'Staging origin gate missing');
assert(script.includes('checkSdk.getToken(check, true)'),'Forced attestation not configured');
assert(script.includes('typeof result?.token === "string" && result.token.length > 0'),'SDK token result check missing');
const start='      const issued = typeof result?.token === "string" && result.token.length > 0;';
const end='    } catch (e) {';
const i=script.indexOf(start);
const j=script.indexOf(end,i);
assert(i>=0&&j>i,'Token result classification block missing');
const block=script.slice(i,j);
assert(!/expireTimeMillis/.test(block),'Removed expiration assertion reappeared');
assert(!/console\.log\s*\(/.test(block),'Token classifier directly logs data');
const tests=[
  ['VALID_NONEMPTY_NO_EXPIRY_FIELD',{token:'fixture-do-not-use'},'ISSUED_NONEMPTY','TOKEN_ISSUANCE_OBSERVED'],
  ['EMPTY_TOKEN',{token:''},'NO_NONEMPTY_TOKEN','NOT_VERIFIED'],
  ['TOKEN_MISSING',{},'NO_NONEMPTY_TOKEN','NOT_VERIFIED'],
  ['NULL_RESULT',null,'NO_NONEMPTY_TOKEN','NOT_VERIFIED'],
  ['NONSTRING_TOKEN',{token:123},'NO_NONEMPTY_TOKEN','NOT_VERIFIED'],
];
let passes=0;
for(const [name,result,wantToken,wantAttest] of tests){
  const reported=[];
  const context={result,report:(name,value)=>reported.push([name,value])};
  vm.runInNewContext(block,context,{timeout:500});
  assert.equal(reported.length,2,'Unexpected report count');
  assert.equal(reported[0][0],'TOKEN_RESPONSE');
  assert.equal(reported[0][1],wantToken);
  assert.equal(reported[1][0],'REAL_BROWSER_ATTESTATION');
  assert.equal(reported[1][1],wantAttest);
  // Fixture never prints a token or credentials.
  assert(!JSON.stringify(reported).includes('fixture-do-not-use'));
  console.log('P231_FIXTURE_'+name+'=PASS');
  passes++;
}
console.log('P231_OFFLINE_FIXTURES='+passes+'/'+tests.length+'_PASS');
console.log('P231_REAL_BROWSER_ATTESTATION=NOT_PERFORMED');
console.log('P231_REAL_VALID_APPCHECK_TOKEN=NOT_VERIFIED');
console.log('P231_APP_CHECK_E2E=NOT_PERFORMED');
console.log('P231_IAM_WRITES=0');
console.log('P231_DEPLOY=NOT_PERFORMED');
console.log('P231_CLEANUP=NOT_PERFORMED');
console.log('P231_RELEASE=NO_GO');
