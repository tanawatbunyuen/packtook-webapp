/** RR-full: evaluate P48 wallet functions extracted from the ACTUAL branch production handler.
 * Isolated Node VM, fake HttpsError, no Firebase/HTTP/calls to deployed exports.
 * This proves helper-level behavior, NOT Firestore production payment handler execution.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync(new URL('../payment-functions/index.js',import.meta.url),'utf8');
const begin=src.indexOf('function periodId(at)');
const end=src.indexOf('function billingOpen(a)');
assert.ok(begin>=0&&end>begin,'expected source functions are present');
const fnSrc=src.slice(begin,end);
const limitsLine=src.match(/const limits=\{[^\n]+\};/)?.[0];
assert.ok(limitsLine,'production plan limits expected');
class TestHttpsError extends Error{constructor(code,msg){super(msg);this.code=code}}
const ctx=vm.createContext({Date,Math,Number,Object,TestHttpsError,Error,JSON});
const get=vm.runInContext(`
const HttpsError=TestHttpsError;
${limitsLine}
const CREDIT_GRACE_DAYS=10,CREDIT_GRACE_MS=CREDIT_GRACE_DAYS*86400000;
const PLAN_TIERS=['Free','Starter','Basic','Growth','Business','Pro'];
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
${fnSrc}
({carryoverCredits,purchasedCreditBalance,creditAvailable,purchaseDecision});
`,ctx,{timeout:2000});
const now=Date.parse('2026-11-13T00:00:00.000Z');
const known={plan:'Starter',planExpiresAt:'2026-12-01T00:00:00.000Z',
  creditWalletV1:true,creditWalletRemaining:77,used:0,reserved:0,
  period:'2026-11',billingVersion:3,openBillingRequestId:'request_demo_001'};
test('P48 real-source helper: known wallet carries exactly 77 credits',()=>{
 assert.equal(get.carryoverCredits(known,now),77);
 const result=get.purchasedCreditBalance(known,'Basic',now);
 assert.equal(result.purchased,300);assert.equal(result.transferred,77);
 assert.equal(result.total,377);
});
test('P48 unknown current plan blocks credit transfer rather than producing 0',()=>{
 const unknown={...known,plan:'UnknownCustomTier'};
 assert.throws(()=>get.purchasedCreditBalance(unknown,'Basic',now),/Unknown plan/);
 assert.equal(unknown.creditWalletRemaining,77,'wallet fixture must be unmodified');
});
test('P48 purchase decision on unknown plan is denied',()=>{
 const result=get.purchaseDecision({...known,plan:'UnknownCustomTier'},'Basic',now);
 assert.equal(result.allowed,false);
 assert.match(result.reason,/Unknown current plan/);
});
test('P48 unknown plan does not silently return zero available credits',()=>{
 assert.throws(()=>get.creditAvailable({...known,plan:'UnknownCustomTier'},now),/Unknown plan/);
});
test('P48 unknown plan still fails closed during expired grace',()=>{
 const unknown={...known,plan:'UnknownCustomTier',
   planExpiresAt:'2026-11-12T00:00:00.000Z'};
 assert.throws(()=>get.purchasedCreditBalance(unknown,'Basic',now),/Unknown plan/);
 assert.equal(unknown.creditWalletRemaining,77);
});
test('P48 actual handler routes failed-precondition transfer to paid-credit review',()=>{
 assert.match(src,/credits=purchasedCreditBalance\(a,item\.plan\)/);
 assert.match(src,/if\(e\?\.code!=="failed-precondition"\)throw e;/);
 assert.match(src,/return markPaidCreditReview\("invalid_credit_transfer"\)/);
});
