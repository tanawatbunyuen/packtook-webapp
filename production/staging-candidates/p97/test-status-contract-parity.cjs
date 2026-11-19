"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const {projectUsageStatus}=require("./status-contract-projection.cjs");
const {extract}=require("../../ast-review/p96-status-contract-audit.cjs");
const SOURCE=fs.readFileSync(path.resolve(__dirname,"../../functions/index.js"),"utf8");
const NOW=Date.parse("2026-11-19T09:00:00.000Z");
function fn(name){
 const p=SOURCE.indexOf("function "+name+"(");
 if(p<0)throw Error("MISSING_ORIGINAL_HELPER_"+name);
 const open=SOURCE.indexOf("{",p);
 let depth=0;
 for(let i=open;i<SOURCE.length;i++){
  if(SOURCE[i]==="{")depth++;
  else if(SOURCE[i]==="}" && --depth===0)return SOURCE.slice(p,i+1);
 }
 throw Error("UNCLOSED_HELPER_"+name);
}
function sourceRuntime(account){
 const sandbox={exports:{},options:{},Date:class extends Date{static now(){return NOW;}},
  uid:()=> "p97_demo_user",
  guardedCall:(_opts,handler)=>handler,
  ensureAccount:async()=>({get:async()=>({exists:account!==null,data:()=>account})}),
  HttpsError:class extends Error{constructor(code,msg){super(msg);this.code=code;}}
 };
 const limitsLine=SOURCE.match(/^const limits=\{[^\n]+/m)?.[0];
 assert.ok(limitsLine,"original limits not found");
 const helpers=["periodId","subscriptionState","walletEnabled","validCounter","pendingReservations","creditAvailable"];
 vm.runInNewContext([limitsLine,...helpers.map(fn),extract(SOURCE,"usageStatus")].join("\n"),sandbox);
 return {handler:sandbox.exports.usageStatus,HttpsError:sandbox.HttpsError};
}
function data(account){
 return {plan:"Free",period:"2026-11",used:3,reserved:2,...account};
}
const fixtures=[
 ["free current month",data({})],
 ["free zero",data({used:0,reserved:0})],
 ["free over limit",data({used:20,reserved:5})],
 ["free previous month",data({period:"2026-10",used:10,reserved:4})],
 ["wallet free",data({creditWalletV1:true,creditWalletRemaining:12,walletStartingCredits:50})],
 ["wallet previous month",data({period:"2026-10",creditWalletV1:true,creditWalletRemaining:5,reserved:3})],
 ["starter active",data({plan:"Starter",planExpiresAt:"2027-01-01T00:00:00.000Z",used:30,reserved:2})],
 ["business expired",data({plan:"Business",planExpiresAt:"2026-11-01T00:00:00.000Z"})],
 ["basic unconfigured",data({plan:"Basic"})],
 ["growth invalid expiry",data({plan:"Growth",planExpiresAt:"INVALID"})],
 ["pro unlimited",data({plan:"Pro",planExpiresAt:"2027-01-01T00:00:00.000Z",used:999,reserved:4})],
 ["starter open billing",data({plan:"Starter",planExpiresAt:"2027-01-01T00:00:00.000Z",openBillingRequestId:"req_demo"})],
 ["wallet empty",data({creditWalletV1:true,creditWalletRemaining:0,walletStartingCredits:0})],
 ["no optional counters",{plan:"Free",period:"2026-11"}],
 ["unexpected starting credits without wallet",data({walletStartingCredits:300})]
];
for(const [label,account] of fixtures){
 test("P97 exact output parity: "+label,async()=>{
  const original=await sourceRuntime(account).handler({auth:{uid:"p97_demo_user"}});
  const candidate=projectUsageStatus(account,{now:NOW,HttpsError:sourceRuntime(account).HttpsError});
  assert.deepEqual(JSON.parse(JSON.stringify(candidate)),JSON.parse(JSON.stringify(original)));
  assert.deepEqual(Object.keys(candidate).sort(),Object.keys(original).sort());
 });
}
for(const [label,account] of [
 ["unknown plan",data({plan:"Unknown"})],
 ["negative reserved",data({reserved:-1})],
 ["fraction reserved",data({reserved:0.5})],
 ["invalid used",data({used:-1})],
 ["counter overflow",data({used:Number.MAX_SAFE_INTEGER,reserved:2})],
 ["wallet negative balance",data({creditWalletV1:true,creditWalletRemaining:-1})],
 ["wallet noninteger balance",data({creditWalletV1:true,creditWalletRemaining:0.5})],
 ["no account",null]
]){
 test("P97 error parity: "+label,async()=>{
  const original=sourceRuntime(account);
  let oldError;
  try{await original.handler({});}catch(e){oldError=e;}
  assert.ok(oldError,label+" original must reject");
  let candidateError;
  try{projectUsageStatus(account,{now:NOW,HttpsError:original.HttpsError});}
  catch(e){candidateError=e;}
  assert.ok(candidateError,label+" candidate must reject");
  assert.equal(candidateError.code,oldError.code,label+" code parity");
 });
}
test("P97 original owner account mapping is repo-static identity only",()=>{
 const map=SOURCE.match(/async function accountIdFor\(uidValue\)\{([^}]+)\}/);
 assert.ok(map);
 assert.match(map[1],/return uidValue/);
 assert.match(SOURCE,/function own\(uid\)\{return db\.collection\("accounts"\)\.doc\(uid\)\}/);
 // No real Staging deployed source/Firestore access proof.
});
test("P97 fixture adapter is isolated and unregistered",()=>{
 assert.equal(SOURCE.includes('status-contract-projection.cjs'),false);
 assert.equal(SOURCE.includes('createP81LegacyHandlers('),false);
});
