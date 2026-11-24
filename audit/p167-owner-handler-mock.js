#!/usr/bin/env node
"use strict";
/* P167 source-extracted full Owner Analytics HANDLER invocation, offline.
 * A sandboxed mock Admin SDK records privileged operations. Never import
 * functions/index.js, use Firebase services, recovered Owner code, or cloud.
 */
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const p166=require("./p166-owner-claim-negative.js");
const SRC=path.join(__dirname,"../functions/index.js");
const expected="92262ea2fbbb941188937d72f0eea74a735d2bf3";
const names=["ownerAnalyticsSummary","ownerAnalyticsCustomers"];

function extract(source){
  if(p166.gitBlob(Buffer.from(source))!==expected)throw Error("source_drift");
  const fragments=p166.auditedFragments(source);
  const marker="exports.ownerAnalyticsSummary=onCall(ownerOptions,async req=>{";
  const start=source.indexOf(marker);
  if(start<0||source.indexOf(marker,start+1)>=0)throw Error("handler_start_invalid");
  const suffix=source.slice(start);
  if(!suffix.includes("exports.ownerAnalyticsCustomers=onCall(ownerOptions,async req=>{"))
    throw Error("customer_handler_missing");
  const count=(suffix.match(/exports\.\w+\s*=\s*onCall\(/g)||[]).length;
  if(count!==2)throw Error("unexpected_export_count");
  return {fragments,suffix};
}

function sandboxFor(source){
  const {fragments,suffix}=extract(source);
  let databaseOperations=0,authDirectoryOperations=0;
  const empty={empty:true,size:0,docs:[]};
  const query={
    orderBy(){return this;},
    limit(){return this;},
    startAfter(){return this;},
    get:async()=>{databaseOperations++;return empty;},
  };
  class HttpsError extends Error{constructor(code,msg){super(msg);this.code=code;}}
  const db={collection(){databaseOperations++;return query;}};
  const admin={firestore:{FieldPath:{documentId:()=> "__name__"}},
    auth:()=>({getUsers:async()=>{authDirectoryOperations++;return {users:[]};}})};
  const exports={};
  const context=vm.createContext({
    HttpsError,db,admin,exports,
    onCall:(_opts,fn)=>fn,
    ownerOptions:{region:"demo"},
    pricesTHB:{Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990},
    OWNER_MAX_ACCOUNTS:1200,OWNER_BATCH:100,OWNER_CONCURRENCY:12,
    data:req=>(req.data&&typeof req.data==="object"?req.data:{}),
    ownerMonthTH:ms=>new Date(ms+7*3600000).toISOString().slice(0,7),
    ownerTimestamp:v=>v==null?null:Number(v),
    subscriptionState:()=> "free",
    creditAvailable:()=>20,
    pendingReservations:()=>0,
    limits:{Free:20},
    console:{warn:()=>{throw Error("unexpected_console_warn");},
             error:()=>{throw Error("unexpected_console_error");}},
  });
  // JS is the exact source-extracted guard + both complete handler definitions.
  // The rest of the backend is not imported or evaluated.
  vm.runInContext('"use strict";\n'+fragments.uid+'\n'+fragments.owner+
    '\n'+suffix,context,{timeout:2000});
  for(const name of names)if(typeof exports[name]!=="function")throw Error("handler_not_registered");
  return {handlers:exports,counters:()=>({databaseOperations,authDirectoryOperations})};
}

async function run(){
  console.log("P167_MODE=SOURCE_EXTRACTED_FULL_HANDLERS_WITH_MOCK_ADMIN");
  const source=fs.readFileSync(SRC,"utf8");
  const {handlers,counters}=sandboxFor(source);
  console.log("P167_PINNED_SOURCE_AND_HANDLER_EXTRACTION=PASS");
  const scenarios=[
    ["SIGNED_OUT",{}, "unauthenticated"],
    ["UNVERIFIED_EMAIL",{auth:{uid:"fake",token:{email_verified:false,packtookPlatformOwner:true}}},"permission-denied"],
    ["CUSTOMER_ADMIN",{auth:{uid:"fake",token:{email_verified:true,admin:true,role:"admin"}}},"permission-denied"],
    ["FALSE_CLAIM",{auth:{uid:"fake",token:{email_verified:true,packtookPlatformOwner:false}}},"permission-denied"],
    ["STRING_CLAIM",{auth:{uid:"fake",token:{email_verified:true,packtookPlatformOwner:"true"}}},"permission-denied"],
    ["FORGED_PAYLOAD",{auth:{uid:"fake",token:{email_verified:true}},data:{packtookPlatformOwner:true,accountId:"victim"}},"permission-denied"],
  ];
  for(const name of names){
    for(const [label,request,wanted] of scenarios){
      const before=counters();
      let observed="none";
      try{await handlers[name](request);observed="unexpected_success";}
      catch(e){observed=e.code||"unexpected_exception";}
      const after=counters();
      const pass=observed===wanted
          && before.databaseOperations===after.databaseOperations
          && before.authDirectoryOperations===after.authDirectoryOperations;
      console.log("P167_"+name.toUpperCase()+"_"+label+"="+(pass?"PASS":"FAIL"));
      if(!pass)throw Error("auth_before_database_gate_failed");
    }
    const owner={auth:{uid:"synthetic-owner",token:{
      email_verified:true,packtookPlatformOwner:true}},data:{}};
    const before=counters();
    const result=await handlers[name](owner);
    const after=counters();
    const pass=after.databaseOperations>before.databaseOperations
      && after.authDirectoryOperations===before.authDirectoryOperations
      && (name==="ownerAnalyticsSummary"?
        result.totals.customers===0&&result.scannedAccounts===0:
        Array.isArray(result.customers)&&result.customers.length===0);
    console.log("P167_"+name.toUpperCase()+"_VALID_OWNER_EMPTY_DATA="+(pass?"PASS":"FAIL"));
    if(!pass)throw Error("synthetic_owner_empty_store_failed");
  }
  console.log("P167_NEGATIVE_AUTH_BEFORE_DATA=12/12_PASS");
  console.log("P167_POSITIVE_OWNER_EMPTY_MOCK=2/2_PASS");
  console.log("P167_NO_REAL_CUSTOMERS=TRUE P167_BACKEND_IMPORTS=0 P167_CLOUD_CALLS=0 P167_DEPLOYS=0");
  console.log("P167_RECOVERED_OWNER_HANDLERS_EXECUTED=FALSE");
  console.log("P167_FIREBASE_CALLABLE_HTTP_RUNTIME_ATTESTED=FALSE");
  console.log("P167_DECISION=EXTRACTED_HANDLER_AUTH_GATES_ATTESTED_RUNTIME_NO_GO");
}
if(require.main===module)run().catch(()=>{console.log("P167_DECISION=NO_GO_HANDLER_TEST_FAILURE");process.exitCode=1;});
module.exports={extract,sandboxFor,run};
