// PACKTOOK V7.2 Secret/IAM metadata-only audit fixtures.
// No GCP connection. Verifies allowlisted gcloud reads and conservative NO-GO.
import assert from "node:assert/strict";
import fs from "node:fs";
import {PROJECT,REGION,SECRET,verifySourceBinding,readMetadata,
 summarizeAudit,auditWithRunner} from "./v72-secret-iam-audit.mjs";

const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
const src=verifySourceBinding(source);
assert.equal(src.pass,true,JSON.stringify(src.checks));
assert.equal(src.checks.pilotStatusBinding,true);
assert.equal(src.checks.pilotSignupBinding,true);
assert.equal(verifySourceBinding(source.replace(
 'defineSecret("'+SECRET+'")','defineSecret("unsafe")')).pass,false);
assert.equal(verifySourceBinding(source.replace(
 'exports.completePilotFreeSignup=onCall({...options,enforceAppCheck:true,\n secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET]}',
 'exports.completePilotFreeSignup=onCall({...options,enforceAppCheck:true}')).pass,false);

const runtime="serviceAccount:read-only-runtime@packtook-prod-01.iam.gserviceaccount.com";
const secretMeta={name:"projects/"+PROJECT+"/secrets/"+SECRET,
 secretPayload:"MUST_NEVER_APPEAR_IN_REPORT"};
const versions=[{state:"ENABLED"},{state:"DISABLED"}];
const secretIam={bindings:[{role:"roles/secretmanager.secretAccessor",members:[runtime]}]};
const projectIam={bindings:[{role:"roles/logging.viewer",members:[runtime]}]};
const mockFn=name=>({
 name:"projects/"+PROJECT+"/locations/"+REGION+"/functions/"+name,
 state:"ACTIVE",
 serviceConfig:{serviceAccountEmail:runtime.slice("serviceAccount:".length),
  secretEnvironmentVariables:[{key:SECRET,secret:SECRET,version:"1"}] }
});
const absent=()=>{const error=new Error("NOT_FOUND: function has not been deployed");error.stderr="NOT_FOUND";throw error};
const goodRunner=(_cmd,args)=>{
 const key=args.slice(0,3).join(" ");
 if(args[0]==="secrets"&&args[1]==="describe")return JSON.stringify(secretMeta);
 if(key==="secrets versions list")return JSON.stringify(versions);
 if(args[0]==="secrets"&&args[1]==="get-iam-policy")return JSON.stringify(secretIam);
 if(args[0]==="projects"&&args[1]==="get-iam-policy")return JSON.stringify(projectIam);
 if(args[0]==="functions"&&args[1]==="describe"){
  if(["pilotInvitationStatus","completePilotFreeSignup"].includes(args[2]))return absent();
  return JSON.stringify(mockFn(args[2]));
 }
 throw Error("Unexpected command "+JSON.stringify(args));
};
const good=auditWithRunner(source,goodRunner);
assert.equal(good.secret.resourcePresent,true);
assert.equal(good.secret.enabledVersionCount,1);
assert.equal(good.source.pass,true);
assert.equal(good.checks.publicStatusSecretBound,true);
assert.equal(good.checks.publicSignupSecretBound,true);
assert.equal(good.iam.deployedRuntimeIdentityCount,1);
assert.equal(good.iam.runtimeBindings[0].directSecretAccessor,true);
assert.equal(good.iam.runtimeBindings[0].effectiveAccessProven,false);
assert.equal(good.metadataInspectionComplete,true);
assert.equal(good.readyForPilot,false);
assert.equal(good.decision,"NO_GO_CONTROLLED_PILOT");
assert(!JSON.stringify(good).includes("read-only-runtime@"),"Runtime identity must be redacted");
assert(!JSON.stringify(good).includes("MUST_NEVER_APPEAR"),"Payload must be redacted");
assert.equal(good.cloudFunctions.filter(x=>x.deployed===true).length,2);
assert.equal(good.cloudFunctions.filter(x=>x.inspectionError==="NOT_FOUND").length,2);
console.log("PASS: source binding + secret metadata/versions + two deployed Public callables inspected without payload or runtime principal leak");

const notEnabled=auditWithRunner(source,(c,a)=>a[0]==="secrets"&&a[1]==="versions"?
 JSON.stringify([{state:"DISABLED"}]):goodRunner(c,a));
assert(notEnabled.blockers.includes("ENABLED_SECRET_VERSION_NOT_VERIFIED"));
const missingSecret=auditWithRunner(source,(c,a)=>{
 if(a[0]==="secrets"&&a[1]==="describe")return absent();
 return goodRunner(c,a);
});
assert.equal(missingSecret.secret.resourcePresent,false);
assert(missingSecret.blockers.includes("SECRET_RESOURCE_NOT_VERIFIED"));
const denied=auditWithRunner(source,(c,a)=>{
 if(a[0]==="secrets"&&a[1]==="get-iam-policy"){
  const error=new Error("PERMISSION_DENIED");error.stderr="PERMISSION_DENIED";throw error;
 }
 return goodRunner(c,a);
});
assert.equal(denied.iam.secretPolicyReadable,false);
assert.equal(denied.iam.secretPolicyError,"PERMISSION_DENIED");
assert(denied.blockers.includes("IAM_POLICY_METADATA_NOT_FULLY_READABLE"));
console.log("PASS: secret absent, disabled versions, IAM 403 all fail closed (never guessed READY)");

const noGrant=auditWithRunner(source,(c,a)=>{
 if(a[0]==="secrets"&&a[1]==="get-iam-policy")return JSON.stringify({bindings:[]});
 return goodRunner(c,a);
});
assert(noGrant.blockers.includes("DIRECT_RUNTIME_SECRET_ACCESSOR_GRANT_NOT_PROVEN"));
const projectGrant=auditWithRunner(source,(c,a)=>{
 if(a[0]==="secrets"&&a[1]==="get-iam-policy")return JSON.stringify({bindings:[]});
 if(a[0]==="projects"&&a[1]==="get-iam-policy")
  return JSON.stringify({bindings:[{role:"roles/secretmanager.secretAccessor",members:[runtime]}]});
 return goodRunner(c,a);
});
assert.equal(projectGrant.iam.runtimeBindings[0].projectSecretAccessor,true);
assert.equal(projectGrant.iam.effectiveRuntimeAccessVerified,false);
const conditional=auditWithRunner(source,(c,a)=>{
 if(a[0]==="secrets"&&a[1]==="get-iam-policy")
  return JSON.stringify({bindings:[{role:"roles/secretmanager.secretAccessor",
   members:[runtime],condition:{expression:"request.time < timestamp('2099-01-01T00:00:00Z')"}}]});
 return goodRunner(c,a);
});
assert.equal(conditional.iam.runtimeBindings[0].conditionalSecretAccessor,true);
assert.equal(conditional.iam.runtimeBindings[0].directSecretAccessor,false);
assert(conditional.blockers.includes("DIRECT_RUNTIME_SECRET_ACCESSOR_GRANT_NOT_PROVEN"));
const broad=auditWithRunner(source,(c,a)=>{
 if(a[0]==="projects"&&a[1]==="get-iam-policy")
  return JSON.stringify({bindings:[{role:"roles/secretmanager.secretAccessor",
   members:["allAuthenticatedUsers"]}]});
 return goodRunner(c,a);
});
assert(broad.blockers.includes("OVERBROAD_SECRET_POLICY_REVIEW_REQUIRED"));
const pilotLive=auditWithRunner(source,(c,a)=>{
 if(a[0]==="functions"&&a[1]==="describe")return JSON.stringify(mockFn(a[2]));
 return goodRunner(c,a);
});
assert(pilotLive.blockers.includes("PILOT_FUNCTION_ALREADY_DEPLOYED_OWNER_REVIEW_REQUIRED"));
console.log("PASS: absent/conditional/project-level grants, publicly exposed role and unexpected Pilot deployment flagged for review");

let executed=false;
assert.throws(()=>readMetadata("gcloud",
 ["secrets","versions","access","latest","--project="+PROJECT],()=>{executed=true}),
 /SAFETY BLOCK/);
assert.equal(executed,false);
assert.throws(()=>readMetadata("gcloud",["secrets","add-iam-policy-binding",SECRET],()=>{executed=true}),
 /SAFETY BLOCK/);
assert.equal(executed,false);
assert.throws(()=>readMetadata("gcloud",["functions","deploy","completePilotFreeSignup"],()=>{executed=true}),
 /SAFETY BLOCK/);
assert.equal(executed,false);
const out=JSON.stringify(good);
assert(!out.includes("secretPayload")&&!out.includes("read-only-runtime@"));
assert.equal(good.secret.payloadRead,false);
assert.equal(good.iam.rawPrincipalsReturned,false);
console.log("PASS: gcloud commands allowlisted for metadata only; secret payload, IAM members and runtime email not printed");
console.log("RESULT: PACKTOOK V7.2 SECRET/IAM AUDIT OFFLINE REGRESSION PASS (not Cloud runtime proof)");
