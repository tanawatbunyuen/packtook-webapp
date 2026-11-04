// V7.2 fixed-URL live-surface preflight negative tests. OFFLINE / NO HTTP.
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessV72LiveSurfaces,shouldRetryPublicProbe} from "./v72-live-surfaces-preflight.mjs";
const src=fs.readFileSync(new URL("./v72-live-surfaces-preflight.mjs",import.meta.url),"utf8");
const good={
 ownerHome:{http:200,body:'<div id="ownerApp" hidden>Owner Dashboard</div>'},
 ownerJS:{http:200,body:'const summary=api("ownerAnalyticsSummary");'},
 ownerConfig:{http:200,body:'export const firebaseConfig={"projectId":"packtook-prod-01","authDomain":"packtook-prod-01.firebaseapp.com","apiKey":"fixture_only"};'},
 pilotPage:{http:404,body:""},
 remote:{customer:{http:200},marketing:{http:200},
  status:{http:200,reachable:true,publicSignupEnabled:false,publicAccessEnabled:false}}
};
const check=change=>assessV72LiveSurfaces({...good,...change});
const ok=check({});
assert.equal(ok.prelaunchSurfacesPass,true);
assert.equal(ok.readyForPilot,false);
assert.equal(ok.readyForPublic,false);
assert.equal(ok.decision,"NO_GO_CONTROLLED_PILOT");
assert.equal(ok.owner.exactProductionConfig,true);
assert.equal(shouldRetryPublicProbe(ok.publicProbe),false);
assert.equal(shouldRetryPublicProbe({closed:false,publicSignupEnabled:null,publicAccessEnabled:null}),true,
 "Unknown remote should allow exactly one read-only retry");
assert.equal(shouldRetryPublicProbe({closed:false,publicSignupEnabled:true,publicAccessEnabled:false}),false,
 "Explicit Public ON must never be overwritten by a later retry");
assert.equal(shouldRetryPublicProbe({closed:false,publicSignupEnabled:false,publicAccessEnabled:true}),false,
 "Explicit Access ON must never be overwritten");

assert.equal(ok.owner.authenticatedOwnerFirestoreE2E,"OWNER_REPORTED_PASS_NOT_RETESTED_HERE");
assert(!JSON.stringify(ok).includes("fixture_only"),
 "Never print source Firebase API keys in report");
const fails=(delta,reason)=>{
 const result=check(delta);
 assert.equal(result.prelaunchSurfacesPass,false,reason);
 assert.equal(result.readyForPilot,false,reason);
};
fails({ownerHome:{http:404,body:""}},"Owner missing");
fails({ownerJS:{http:200,body:"not the owner app"}},"Owner app JS stale");
fails({ownerConfig:{http:200,body:'"projectId":"packtook-staging"'}},"Staging mismatch");
fails({ownerConfig:{http:200,body:'"projectId":"packtook-prod-01","authDomain":"other.firebaseapp.com"'}},"Domain mismatch");
fails({remote:{...good.remote,status:{http:200,reachable:true,publicSignupEnabled:true,publicAccessEnabled:false}}},"Unexpected signup ON");
fails({remote:{...good.remote,status:{http:200,reachable:true,publicSignupEnabled:false,publicAccessEnabled:true}}},"Unexpected access ON");
fails({remote:{...good.remote,status:{reachable:false,publicSignupEnabled:false,publicAccessEnabled:false}}},"Remote status unreachable");
const unreachable=check({remote:{...good.remote,
 status:{http:null,reachable:false,publicSignupEnabled:null,publicAccessEnabled:null,
  error:"TimeoutError"}}});
assert.equal(unreachable.publicProbe.closed,false);
assert(unreachable.publicProbe.reasons.includes("PUBLIC_STATUS_CALLABLE_UNVERIFIED"));
assert(unreachable.publicProbe.reasons.includes("PUBLIC_SIGNUP_FLAG_UNKNOWN"));
assert(unreachable.publicProbe.reasons.includes("PUBLIC_ACCESS_FLAG_UNKNOWN"));
assert(!unreachable.publicProbe.reasons.includes("PUBLIC_SIGNUP_ENABLED_UNEXPECTEDLY"));
assert.equal(unreachable.publicProbe.statusHttp,null);
assert.equal(unreachable.publicProbe.statusError,"TimeoutError");
const flagOn=check({remote:{...good.remote,
 status:{http:200,reachable:true,publicSignupEnabled:true,publicAccessEnabled:false}}});
assert(flagOn.publicProbe.reasons.includes("PUBLIC_SIGNUP_ENABLED_UNEXPECTEDLY"));
assert.equal(flagOn.publicProbe.publicSignupEnabled,true);
const marketingDown=check({remote:{...good.remote,
 marketing:{http:503,error:"SERVICE_UNAVAILABLE"}}});
assert(marketingDown.publicProbe.reasons.includes("MARKETING_HOSTING_HTTP_NOT_200"));
assert(!marketingDown.publicProbe.reasons.includes("PUBLIC_SIGNUP_ENABLED_UNEXPECTEDLY"));
assert.equal(marketingDown.publicProbe.publicSignupEnabled,false);
const customerDown=check({remote:{...good.remote,customer:{http:null,error:"TimeoutError"}}});
assert(customerDown.publicProbe.reasons.includes("CUSTOMER_HOSTING_HTTP_NOT_200"));
assert.equal(customerDown.publicProbe.publicAccessEnabled,false);

fails({pilotPage:{http:200,
 body:'<title>PACKTOOK — V7.2 Invite-only Pilot</title><form id="loginForm"></form><button id="checkAppCheck">Check</button>'}},"Unexpected existing Pilot page");
assert(!/\b(?:writeFileSync|unlinkSync|execSync|spawnSync|firebase deploy|gcloud secrets versions access)\b/.test(src),
 "Preflight must not write, deploy or access secrets");
assert(src.includes("const allowed=new Set(["));
assert(src.includes("redirect:\"error\""));
assert(src.includes("console.log(JSON.stringify(report,null,2))"));
console.log("PASS: unreachable status versus explicitly ENABLED Public flag and Marketing/Customer outages have distinct reasons");
console.log("PASS: Owner Production surface + remote Public OFF confirmed without credentials or raw config disclosure");
console.log("PASS: staging/Owner missing/unexpected Public ON/unexpected Pilot page all fail closed");
console.log("PASS: no deploy, no secret access, no Auth/Firestore mutation and real-browser claims remain NO-GO");
console.log("RESULT: V7.2 LIVE SURFACES PREFLIGHT OFFLINE SAFETY PASS");
