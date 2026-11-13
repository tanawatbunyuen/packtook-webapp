/** P48 real local Firestore transaction using extracted UNMODIFIED reconcileCharge
 * from production/payment-functions/index.js. The Omise GET is replaced with a
 * synthetic immutable provider response; no endpoint/secrets/real money involved.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../payment-functions/index.js',import.meta.url));
const admin=require('firebase-admin');
const source=readFileSync(new URL('../payment-functions/index.js',import.meta.url),'utf8');
const cut=(start,end)=>{const i=source.indexOf(start),j=source.indexOf(end,i+1);assert.ok(i>=0&&j>i,start);return source.slice(i,j)};
assert.equal(process.env.GCLOUD_PROJECT,'demo-packtook-v72');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT,'demo-packtook-v72');
assert.equal(process.env.GCP_PROJECT,'demo-packtook-v72');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,'127.0.0.1:19099');
assert.equal(process.env.GOOGLE_APPLICATION_CREDENTIALS,undefined);
assert.equal(process.env.FIREBASE_TOKEN,undefined);
assert.equal(process.env.OMISE_SECRET_KEY,undefined);
admin.initializeApp({projectId:'demo-packtook-v72'});
const db=admin.firestore(),FieldValue=admin.firestore.FieldValue;
class HttpsError extends Error {constructor(code,message){super(message);this.code=code}}
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const PLAN_TIERS=['Free','Starter','Basic','Growth','Business','Pro'];
const fixed=(s)=>s;
const current={charge:null};
const context=vm.createContext({
 db,FieldValue,HttpsError,Date,Math,Number,Object,JSON,Error,
 own:(uid)=>db.collection('accounts').doc(uid),
 omiseAPI:async()=>structuredClone(current.charge),
 limits,pricesTHB,PLAN_TIERS,CREDIT_GRACE_DAYS:10,
 CREDIT_GRACE_MS:10*86400000
});
const helpers=cut('function periodId(at)','function billingOpen(a)');
const billing=cut('function billingOpen(a)','// V6.4: an expired QR');
const evidence=cut('function paidEvidence(charge)','async function ensureAccount(id)');
const reconcile=cut('async function reconcileCharge(accountId,requestId,chargeId)','exports.promptpayConfig=');
const functions=vm.runInContext(helpers+billing+evidence+reconcile+'\n({reconcileCharge});',context,{timeout:5000});
let passed=0;const pass=(name)=>{passed++;console.log('PASS P48 FULL_TX '+name)};
const chargeId='chrg_test_p48REALTX123456';
const requestId='p48_tx_request_001';
function provider(acct){
 return {id:chargeId,status:'successful',paid:true,livemode:false,currency:'thb',
 amount:29900,source:{type:'promptpay'},metadata:{uid:acct,requestId},refunded_amount:0};
}
const future=new Date(Date.now()+20*86400000).toISOString();
try {
 const acct='p48_account_unknown_001',ref=db.collection('accounts').doc(acct);
 const bill=ref.collection('billingRequests').doc(requestId);
 await ref.create({plan:'LegacyMysteryTier',planExpiresAt:future,creditWalletV1:true,
 creditWalletRemaining:77,used:0,reserved:0,period:'2026-11',billingVersion:3,
 openBillingRequestId:requestId});
 await bill.create({plan:'Basic',amountTHB:299,requestedBy:acct,
 omiseChargeId:chargeId,paymentMethod:'promptpay',paymentProvider:'omise',
 purchaseKind:'upgrade',basePlan:'LegacyMysteryTier',baseExpiresAt:future,
 baseBillingVersion:3,status:'pending'});
 current.charge=provider(acct);
 const result=await functions.reconcileCharge(acct,requestId,chargeId);
 assert.equal(result.status,'payment_review');
 assert.equal((await ref.get()).data().creditWalletRemaining,77);
 pass('unknown plan paid charge held in payment_review with 77 original credits');
 assert.equal((await ref.get()).data().openBillingRequestId,requestId);
 assert.equal((await ref.get()).data().billingVersion,3);
 pass('unknown plan preserves billing lock and revision, no grant');
 const snap=await bill.get();
 assert.equal(snap.data().status,'payment_review');
 assert.equal((await ref.collection('audit').get()).size,1);
 pass('exactly one manual-review audit on initial unknown-plan reconciliation');
 const again=await functions.reconcileCharge(acct,requestId,chargeId);
 assert.equal(again.status,'payment_review');
 assert.equal((await ref.collection('audit').get()).size,1);
 pass('paid-charge replay is idempotent and creates no duplicate audit');
 const acc2='p48_account_valid_001',ref2=db.collection('accounts').doc(acc2);
 const bill2=ref2.collection('billingRequests').doc(requestId);
 await ref2.create({plan:'Starter',planExpiresAt:future,creditWalletV1:true,
 creditWalletRemaining:77,used:0,reserved:0,period:'2026-11',
 billingVersion:3,openBillingRequestId:requestId});
 await bill2.create({plan:'Basic',amountTHB:299,requestedBy:acc2,
 omiseChargeId:chargeId,paymentMethod:'promptpay',paymentProvider:'omise',
 purchaseKind:'upgrade',basePlan:'Starter',baseExpiresAt:future,
 baseBillingVersion:3,status:'pending'});
 current.charge=provider(acc2);
 const good=await functions.reconcileCharge(acc2,requestId,chargeId);
 assert.equal(good.status,'paid');assert.equal(good.transferredCredits,77);
 assert.equal(good.balanceAfter,377);
 assert.equal((await ref2.get()).data().creditWalletRemaining,377);
 pass('valid upgrade transaction transfers 77 retained credits plus 300 newly purchased');
 assert.equal((await bill2.get()).data().status,'paid');
 assert.equal((await ref2.collection('audit').get()).size,1);
 const replay=await functions.reconcileCharge(acc2,requestId,chargeId);
 assert.equal(replay.status,'paid');assert.equal(replay.alreadyApplied,true);
 assert.equal((await ref2.get()).data().creditWalletRemaining,377);
 assert.equal((await ref2.collection('audit').get()).size,1);
 pass('settled payment retry never double grants or adds audit');
 console.log('P48_REAL_HANDLER_LOCAL_TX: '+passed+'/6 PASS');
 console.log('P48_PROVIDER_CALLS: SYNTHETIC_ONLY');
 console.log('P48_PRODUCTION_WRITES: 0');
 console.log('P48_RELEASE: NO_GO_RELEASE');
} finally {await admin.app().delete()}
