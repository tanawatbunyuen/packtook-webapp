"use strict";
// P121 offline protect-owner-functions evidence gate. Never deploys or calls cloud.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const ev=JSON.parse(fs.readFileSync(path.join(root,"audit/p121-p120-operator-evidence.json"),"utf8"));
const source=fs.readFileSync(path.join(root,"functions/index.js"),"utf8");
const exported=[...source.matchAll(/exports\.(\w+)\s*=\s*(?:onCall|onRequest)\(/g)].map(m=>m[1]);
const owner=["ownerGetCustomerAdjustmentHistory","ownerGetCustomerManageState","ownerGrantVideoCredits","ownerUpdateCustomerExpiry"];
const checks=[];
function check(name,condition){checks.push({name,passed:!!condition});console.log((condition?"PASS ":"BLOCK ")+name)}
check("STAGING_PROJECT_PIN",ev.project==="packtook-staging"&&ev.region==="asia-southeast1");
check("OPERATOR_INVENTORY_COUNTS",ev.cloud_function_count===27&&ev.review_source_export_count===23);
check("SOURCE_EXPORTS_COUNT_MATCH",exported.length===23);
check("EXPECTED_FOUR_CLOUD_ONLY",JSON.stringify(ev.cloud_only)===JSON.stringify(owner));
check("NO_SOURCE_ONLY",Array.isArray(ev.source_only)&&ev.source_only.length===0);
check("OWNER_FUNCTIONS_MISSING_IN_REVIEW_SOURCE",owner.every(n=>!exported.includes(n)));
check("BOTH_TARGETS_IN_REVIEW_SOURCE",["recordingStatus","usageStatus"].every(n=>exported.includes(n)));
check("BOTH_TARGETS_ACTIVE",["recordingStatus","usageStatus"].every(n=>ev.targets[n]?.state==="ACTIVE"));
check("BOTH_TARGETS_CODEBASE_UNSET",["recordingStatus","usageStatus"].every(n=>ev.targets[n]?.codebase_label==="UNSET"));
check("BOTH_TARGETS_REVISION_FIELD_PRESENT",["recordingStatus","usageStatus"].every(n=>ev.targets[n]?.service_revision_present===true));
check("PROVENANCE_NOT_ATTESTED",ev.decision==="NO_GO_DEPLOY_SOURCE_PROVENANCE_UNVERIFIED");
check("NO_CLOUD_WRITES_RECORDED",ev.production_writes===0&&ev.staging_writes===0);
console.log("P121_GUARDED_CLOUD_ONLY="+owner.join(","));
console.log("P121_TESTS="+checks.filter(x=>x.passed).length+"/"+checks.length);
console.log("P121_DECISION=BLOCK_STAGING_DEPLOY_FOUR_OWNER_FUNCTIONS_NOT_IN_SOURCE");
console.log("P121_CLOUD_CALLS=0 P121_DEPLOYS=0");
if(checks.some(x=>!x.passed))process.exitCode=1;
