"use strict";
/**
 * P118 static callable selector isolation contract.
 * Never runs firebase CLI, never accesses cloud, never deploys.
 * Prints suggested selectors as DATA ONLY. Requires fresh external inventory attestation.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const conf=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
const evidence=JSON.parse(fs.readFileSync(path.join(root,"audit/p117-staging-evidence.json"),"utf8"));
const targets=["recordingStatus","usageStatus"];
const allowed=new Set(targets);
const options=Array.isArray(conf.functions)?conf.functions:[conf.functions];
const allExports=[...source.matchAll(/exports\.(\w+)\s*=\s*(onCall|onRequest)\(/g)].map(x=>({name:x[1],type:x[2]}));
const expected=["usageStatus","reserveCredit","finalizeCredit","pendingVideoReservations","recoverStaleVideoReservation","recordingStatus","registerDevice","deviceStatus","removeDevice","authorizeDuplicate","accountRole","subscriptionOverview","billingHistory","requestPlanChange","cancelUnpaidPlanRequest","omisePaymentConfig","createOmisePayment","recoverOmiseCharge","omisePaymentStatus","omisePaymentWebhook","paymentAudit","ownerAnalyticsSummary","ownerAnalyticsCustomers"];
const checks=[];
function check(name,condition){checks.push({name,pass:!!condition});console.log((condition?"PASS ":"BLOCK ")+name)}
check("PROJECT_STAGING_ID_EXPLICIT",evidence.project_id==="packtook-staging");
check("FIREBASE_FUNCTIONS_SINGLE_SOURCE",options.length===1&&options[0]?.source==="functions");
check("FUNCTIONS_CODEBASE_IS_DEFAULT",options[0]?.codebase==="default");
check("EXACT_SOURCE_EXPORT_INVENTORY",JSON.stringify(allExports.map(x=>x.name))===JSON.stringify(expected));
check("NO_DUPLICATE_EXPORT_NAMES",new Set(allExports.map(x=>x.name)).size===allExports.length);
check("TARGET_EXPORTS_EXIST_AND_ARE_CALLABLE",targets.every(x=>allExports.find(f=>f.name===x&&f.type==="onCall")));
check("TARGETS_ONLY_USE_SCOPED_APPCHECK",targets.every(x=>new RegExp("exports\\."+x+"\\s*=\\s*onCall\\(statusOptions,async req=>\\{\\s*const id=uid\\(req\\)").test(source)));
check("SCOPED_APPCHECK_CONFIGURED",/const statusOptions=\{\.\.\.options,enforceAppCheck:true\}/.test(source));
check("ALL_OTHERS_EXCLUDE_STATUS_OPTIONS",allExports.filter(x=>!allowed.has(x.name)).every(x=>!new RegExp("exports\\."+x.name+"\\s*=\\s*onCall\\(statusOptions,").test(source)));
check("SELECTOR_SUBSET_ONLY",targets.every(x=>allowed.has(x))&&targets.length===2);
const selectors=targets.map(x=>"functions:"+x);
check("SELECTORS_ARE_EXPLICIT",selectors.every(x=>/^functions:(recordingStatus|usageStatus)$/.test(x)));
check("NO_DEFAULT_DEPLOY_COMMAND",!fs.existsSync(path.join(root,"audit","p118-execute-deploy.sh")));
check("FIREBASE_PROJECT_NOT_ASSUMED_BY_ALIAS",!fs.existsSync(path.join(root,".firebaserc")));
check("CLOUD_PROVENANCE_UNVERIFIED",evidence.backend_codebase_owner_verified===false&&evidence.status_revisions_verified===false);
check("APP_CHECK_STAGING_UNVERIFIED",evidence.appcheck_registration_verified===false&&evidence.staging_e2e_verified===false);
check("PRODUCTION_DEPLOY_DISALLOWED",evidence.production_deploy_authorized===false);
check("STAGING_DEPLOY_NOT_APPROVED",evidence.owner_staging_deploy_approval===false);
console.log("P118_TARGET_SELECTORS="+selectors.join(","));
console.log("P118_EXPORTED_FUNCTIONS="+allExports.length);
console.log("P118_CHECKS="+checks.filter(x=>x.pass).length+"/"+checks.length);
console.log("P118_DECISION=NO_GO_CLOUD_RUNTIME_UNVERIFIED");
console.log("P118_DEPLOY_EXECUTED=NO P118_CLOUD_CALLS=0");
if(checks.some(x=>!x.pass))process.exitCode=1;
