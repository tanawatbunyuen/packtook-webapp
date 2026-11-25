"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),vm=require("node:vm");
const {EXPECTED_CANDIDATE}=require("../p190/reconcile");
const source=fs.readFileSync(path.resolve(__dirname,"probe/index.js"),"utf8");
const p188=fs.readFileSync(path.resolve(__dirname,"../p188/candidate-index.js"));
const run=new Map(),state={get:0};
const snapshot={exists:true,data:()=>({ownerUid:"g02test_0123456789ABC"})};
const firebase={apps:[],initializeApp(){this.apps.push({})},firestore(){return {
 collection(name){assert.equal(name,"accounts");return{
 doc(id){return {get:async()=>{state.get++;return run.get(id)??{exists:false}}}}
 }}
}}};
let config=null;
const imp=n=>{
 if(n==="firebase-functions/v2/https")return {
 onCall:(options,handler)=>{config=options;return handler},
 HttpsError:class extends Error{constructor(code,message){super(message);this.code=code}}
 };
 if(n==="firebase-admin")return firebase;
 throw Error("UNEXPECTED_IMPORT");
};
const exported={};
vm.compileFunction(source,["exports","require"],{filename:"g02-probe.js"})(exported,imp);
const call=exported.g02AuthzProbe;
const user=(uid,verified=true)=>({auth:{uid,token:{email_verified:verified}},data:{}});
async function denied(f,code){await assert.rejects(f,e=>e.code===code);}
let n=0;async function t(label,fn){await fn();n++;console.log("P220_"+label+"=PASS")}
(async()=>{
 await t("P188_SOURCE_EXACT_SHA_PIN",()=>assert.equal(crypto.createHash("sha256").update(p188).digest("hex"),EXPECTED_CANDIDATE));
 await t("P188_UNSAFE_BACKFILL_REMOVED",()=>assert(!p188.toString().includes('if(!a.ownerUid)tx.update(acc,{ownerUid:accountId});')));
 await t("P188_IMPLICIT_SELF_ADMIN_REMOVED",()=>assert(!p188.toString().includes('const role=ref.id===id?"admin":"operator";')));
 await t("ONLY_TEST_FUNCTION_EXPORT",()=>assert.deepEqual(Object.keys(exported),["g02AuthzProbe"]));
 await t("PRIVATE_IAM_INVOCATION",()=>assert.equal(config.invoker,"private"));
 await t("APPCHECK_ENFORCED",()=>assert.equal(config.enforceAppCheck,true));
 await t("ONE_INSTANCE",()=>assert.equal(config.maxInstances,1));
 await t("SINGLE_REGION",()=>assert.equal(config.region,"asia-southeast1"));
 await t("NO_PAYMENT_OR_WEBHOOK_EXPORTS",()=>assert(!/omise|payment|webhook|billing|signup/i.test(source)));
 await t("NO_FIRESTORE_MUTATIONS",()=>assert(!/\.set\(|\.update\(|\.create\(|\.delete\(|\.add\(|\.runTransaction\(/.test(source)));
 const good="g02test_0123456789ABC";
 run.set(good,snapshot);
 await t("SYNTHETIC_OWNER_ALLOWED",async()=>assert.deepEqual(await call(user(good)),{authorized:true,role:"admin",accountKind:"synthetic-g02-test"}));
 await t("FORGED_OWNER_UID_NOT_READ",async()=>{const before=state.get;await denied(()=>call({...user("real-client-uid"),data:{ownerUid:good}}),"permission-denied");assert.equal(state.get,before)});
 await t("ANONYMOUS_DENIED",()=>denied(()=>call({data:{uid:good}}),"unauthenticated"));
 await t("EMAIL_NOT_VERIFIED_DENIED",()=>denied(()=>call(user(good,false)),"permission-denied"));
 await t("MISSING_SYNTHETIC_ACCOUNT_DENIED",()=>denied(()=>call(user("g02test_999999999999")),"permission-denied"));
 run.set("g02test_111111111111",{exists:true,data:()=>({ownerUid:good})});
 await t("CROSS_TENANT_OWNER_DENIED",()=>denied(()=>call(user("g02test_111111111111")),"permission-denied"));
 await t("EMPTY_OWNER_DENIED",async()=>{run.set("g02test_222222222222",{exists:true,data:()=>({})});await denied(()=>call(user("g02test_222222222222")),"permission-denied")});
 await t("NO_READ_BEFORE_IDENTITY_CHECK",()=>{assert(source.indexOf("synthetic.test(id)")<source.indexOf('db.collection("accounts")'))});
 await t("NO_STAGING_DEPLOY_IN_CI",()=>assert.equal(process.env.GCLOUD_PROJECT,"demo-packtook-p184"));
 await t("NO_PRODUCTION_SCOPE",()=>assert(!source.includes("packtook-prod-01")));
 console.log("P220_G02_ISOLATED_RUNTIME_PROBE_FIXTURES="+n+"/"+n+"_PASS");
 console.log("P220_DEPLOYED_TO_STAGING=FALSE");
 console.log("P220_G02=NO_GO_RELEASE");
})().catch(e=>{console.error("P220_BLOCK="+String(e.message).slice(0,150));process.exitCode=1});
