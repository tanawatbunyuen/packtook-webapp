"use strict";
const assert=require("node:assert/strict"),cp=require("node:child_process"),path=require("node:path");
if(process.env.GCLOUD_PROJECT!=="demo-packtook-p186"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-p186"||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=="127.0.0.1:19096"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18096")
 throw Error("P186_CLI_EMULATOR_GUARD");
const admin=require("./p177-emulator/node_modules/firebase-admin");
admin.initializeApp({projectId:"demo-packtook-p186"});
(async()=>{
 try{
  const a=admin.firestore().collection("accounts");
  await a.doc("p186_owner").set({ownerUid:"p186_owner"});
  await a.doc("p186_legacy").set({plan:"Free"});
  await admin.auth().createUser({uid:"p186_owner",email:"p186_owner@example.invalid",emailVerified:true});
  await admin.auth().createUser({uid:"p186_legacy",email:"p186_legacy@example.invalid",emailVerified:true});
  const child=cp.spawnSync(process.execPath,[path.resolve(__dirname,"p186-g02-operator-cli.js"),
   "--project=demo-packtook-p186","--ack=I_AUTHORIZE_READ_ONLY_G02_INVENTORY","--max-docs=10","--page-size=5"],{
   cwd:path.resolve(__dirname,".."),env:process.env,encoding:"utf8",timeout:30000});
  assert.equal(child.status,0,child.stderr?.slice(-1000));
  const line=child.stdout.split("\n").find(x=>x.startsWith("P186_AGGREGATE_REPORT="));
  assert(line,"missing aggregate");
  const report=JSON.parse(line.slice("P186_AGGREGATE_REPORT=".length));
  assert.equal(report.scanned,2);
  assert.equal(report.counts.ownerVerifiedShape,1);
  assert.equal(report.counts.legacyMissingOwner,1);
  assert.equal(report.counts.legacyManualReview,1);
  assert.equal(report.complete,true);
  assert.equal(report.authorizedToWrite,false);
  assert.equal(report.productionAttested,false);
  assert.equal(report.inventoryFingerprint,undefined);
  assert(!child.stdout.includes("p186_owner")&&!child.stdout.includes("p186_legacy"));
  assert.equal((await a.doc("p186_legacy").get()).data().ownerUid,undefined);
  console.log("P186_ACTUAL_CLI_AGGREGATES_ONLY=PASS");
  console.log("P186_CLI_SYNTHETIC_ACCOUNT_SCAN=2/2_PASS");
  console.log("P186_CLI_NO_ACCOUNT_MUTATION=PASS");
  console.log("P186_CLOUD_READS=0 CLOUD_WRITES=0");
 }finally{
  for(const uid of ["p186_owner","p186_legacy"])try{await admin.auth().deleteUser(uid);}catch{}
  await admin.app().delete();
 }
})().catch(e=>{console.error("P186_LOCAL_CLI_FAILED",e.message);process.exitCode=1;});
