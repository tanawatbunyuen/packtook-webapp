// P55: pure fail-closed auth/AppCheck gate regression. No emulator, secrets or networking.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildDemoRecoveryBackend,createOmiseTestAdapter}=require('../payment-functions/p54-recovery-backend-candidate.cjs');
const env={GCLOUD_PROJECT:'demo-packtook-v72',GOOGLE_CLOUD_PROJECT:'demo-packtook-v72',GCP_PROJECT:'demo-packtook-v72',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099'};
function fixture({appResult={alreadyConsumed:false},decoded={uid:'reviewer_123',email_verified:true},live={uid:'reviewer_123',emailVerified:true,disabled:false,customClaims:{packtookRecoveryOwner:true}},appError,authError,userError}={}){
 const calls=[];
 const api=buildDemoRecoveryBackend({env,now:()=>1,
   appCheck:{async verifyToken(token,opts){calls.push(['app',opts]);if(appError)throw appError;return appResult;}},
   auth:{async verifyIdToken(token,checkRevoked){calls.push(['id',checkRevoked]);if(authError)throw authError;return decoded;},
     async getUser(uid){calls.push(['user',uid]);if(userError)throw userError;return live;}},
   provider:{async getCharge(){calls.push(['provider']);throw Error('PROVIDER_CALLED');}},
   db:{async runTransaction(){throw Error('TX_CALLED')},collection(){return {doc(){calls.push(['db']);throw Error('DB_CALLED');}};}}
 });
 return {api,calls};
}
const input={idToken:'synthetic-token',appCheckToken:'synthetic-appcheck',accountId:'account_demo_01',requestId:'request_demo_01'};
for(const [name,setup,match] of [
 ['consumed App Check',{appResult:{alreadyConsumed:true}},/appcheck_invalid_or_replayed/],
 ['missing App Check verification result',{appResult:null},/appcheck_invalid_or_replayed/],
 ['App Check verifier exception',{appError:Error('appcheck_verification_failed')},/appcheck_verification_failed/],
 ['revoked Firebase token',{authError:Error('auth/id-token-revoked')},/id-token-revoked/],
 ['unverified decoded email',{decoded:{uid:'reviewer_123',email_verified:false}},/unverified_identity/],
 ['disabled user',{live:{uid:'reviewer_123',emailVerified:true,disabled:true,customClaims:{packtookRecoveryOwner:true}}},/role_or_user_not_authorized/],
 ['revoked owner claim',{live:{uid:'reviewer_123',emailVerified:true,disabled:false,customClaims:{}}},/role_or_user_not_authorized/],
 ['missing live Firebase user',{userError:Error('auth/user-not-found')},/user-not-found/]
]){
 test('P55 rejects '+name+' before any data/provider access',async()=>{
   const f=fixture(setup);
   await assert.rejects(()=>f.api.status(input),match);
   assert.equal(f.calls.some(c=>['provider','db'].includes(c[0])),false);
 });
}
test('P55 requires App Check consume and ID token revocation check',async()=>{
 const f=fixture({live:{uid:'reviewer_123',emailVerified:true,disabled:false,customClaims:{}}});
 await assert.rejects(()=>f.api.status(input),/role_or_user_not_authorized/);
 assert.equal(f.calls[0][0],'app');assert.equal(f.calls[0][1].consume,true);
 assert.deepEqual(f.calls[1],['id',true]);
});
test('P55 rejects absent token values before verifier or data access',async()=>{
 const f=fixture();
 await assert.rejects(()=>f.api.status({accountId:'account_demo_01',requestId:'request_demo_01'}),/identity_and_appcheck_required/);
 assert.equal(f.calls.length,0);
});
test('P55 test-only Omise adapter rejects secret with test prefix but not exact test key shape on missing secret',async()=>{
 let called=false;
 const adapter=createOmiseTestAdapter({readSecret:async()=>undefined,fetchImpl:async()=>{called=true;return {ok:true}}});
 await assert.rejects(()=>adapter.getCharge('chrg_test_p55ABC123'),/omise_test_key_only/);
 assert.equal(called,false);
});
