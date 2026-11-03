// PACKTOOK V7.1 — OFFLINE local App ID preparation regression (NO FILE WRITES).
import assert from "node:assert/strict";
import {prepareCustomerAppId} from "./configure-v71-public-app-id.mjs";
import {appIdEvidence} from "./v71-public-app-id-preflight.mjs";

const appId="1:123456789:web:aBcDef1234";
const config='export const firebaseConfig = {"projectId":"packtook-prod-01","authDomain":"packtook-prod-01.firebaseapp.com","appId":"'+appId+'"};';
const safe=[
 "PACKTOOK_PRODUCTION_PROJECT_ID=packtook-prod-01",
 "PACKTOOK_PUBLIC_SIGNUP_ENABLED=false",
 "PACKTOOK_PUBLIC_ACCESS_ENABLED=false",
 "PACKTOOK_PUBLIC_POLICIES_APPROVED=false",
 "PACKTOOK_V7_QA_ENABLED=false",
 "ANOTHER_KEY=preserve_me"
].join("\n")+"\n";
const before=prepareCustomerAppId({specific:safe,config});
assert.equal(before.changed,true);
assert(before.updated.includes("ANOTHER_KEY=preserve_me"));
assert(before.updated.includes("PACKTOOK_PUBLIC_CUSTOMER_APP_ID="+appId));
assert.equal(before.updated.match(/PACKTOOK_PUBLIC_CUSTOMER_APP_ID=/g)?.length,1);
const evidence=appIdEvidence({specific:before.updated,customerConfig:config});
assert.equal(evidence.exactMatch,true);
const repeat=prepareCustomerAppId({specific:before.updated,config});
assert.equal(repeat.changed,false);
assert.equal(repeat.updated,before.updated);
const blocked=value=>assert.throws(value,/SAFETY BLOCK/);
blocked(()=>prepareCustomerAppId({
 specific:safe.replace("PACKTOOK_PUBLIC_SIGNUP_ENABLED=false","PACKTOOK_PUBLIC_SIGNUP_ENABLED=true"),config
}));
blocked(()=>prepareCustomerAppId({
 specific:safe.replace("PACKTOOK_PUBLIC_ACCESS_ENABLED=false","PACKTOOK_PUBLIC_ACCESS_ENABLED=true"),config
}));
blocked(()=>prepareCustomerAppId({
 specific:safe.replace("PACKTOOK_PUBLIC_POLICIES_APPROVED=false","PACKTOOK_PUBLIC_POLICIES_APPROVED=true"),config
}));
blocked(()=>prepareCustomerAppId({
 specific:safe.replace("PACKTOOK_V7_QA_ENABLED=false","PACKTOOK_V7_QA_ENABLED=true"),config
}));
blocked(()=>prepareCustomerAppId({
 specific:before.updated.replace(appId,"1:999:web:wrongApp"),config
}));
blocked(()=>prepareCustomerAppId({
 specific:before.updated+"\nPACKTOOK_PUBLIC_CUSTOMER_APP_ID="+appId,config
}));
blocked(()=>prepareCustomerAppId({
 specific:safe,generic:"PACKTOOK_PUBLIC_CUSTOMER_APP_ID="+appId,config
}));
blocked(()=>prepareCustomerAppId({
 specific:safe,config:config.replace("packtook-prod-01.firebaseapp.com","other.firebaseapp.com")
}));
blocked(()=>prepareCustomerAppId({
 specific:safe,config,environment:{PACKTOOK_PUBLIC_CUSTOMER_APP_ID:"1:999:web:other"}
}));
console.log("PASS: exact appId copied from verified Customer config and unrelated dotenv preserved");
console.log("PASS: repeat operation is idempotent; all QA/Public gates OFF enforced");
console.log("PASS: wrong AppID, duplicate keys, generic appId, shell overrides and wrong project blocked");
console.log("RESULT: PACKTOOK V7.1 LOCAL CUSTOMER APP ID CONFIG SAFETY PASS (offline only)");
