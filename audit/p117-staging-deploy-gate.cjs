"use strict";
/*
P117: Firebase staging deployment readiness evidence gate (offline/read-only).
No deploy commands, cloud writes, credentials, or runtime probes.
Exit 0 means the protective NO_GO decision was enforced, NOT permission to deploy.
*/
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"..");
const load=p=>fs.readFileSync(path.join(root,p),"utf8");
const backend=load("functions/index.js");
const frontend=load("firebase-staging/firebase-packing-bridge.js");
const appConfig=load("firebase-staging/firebase-v4-config.js");
const firebase=JSON.parse(load("firebase.json"));
const ev=JSON.parse(load("audit/p117-staging-evidence.json"));
const checks=[];
const ck=(label,condition)=>{checks.push({label,pass:Boolean(condition)});console.log((condition?"PASS ":"BLOCK ")+label)};
const hasFirebaseRc=fs.existsSync(path.join(root,".firebaserc"));
const statusOpts=backend.match(/const statusOptions\s*=\s*(\{[^;]+\})/);
const key=appConfig.match(/export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*["']([^"']*)["']/);
ck("STAGING_PROJECT_CONFIG_PINNED",/projectId\s*:\s*["']packtook-staging["']/.test(appConfig));
ck("SCOPED_BACKEND_APP_CHECK",Boolean(statusOpts&&/enforceAppCheck\s*:\s*true/.test(statusOpts[1])));
ck("CLIENT_FAIL_CLOSED_WITHOUT_KEY",/if\(!appCheckReady\)throw Error/.test(frontend));
ck("CLIENT_APP_CHECK_INITIALIZED",/initializeAppCheck\(app,\{provider:new ReCaptchaEnterpriseProvider/.test(frontend));
ck("STAGING_SITE_KEY_PROVISIONED",Boolean(key&&key[1].trim()));
ck("EXPLICIT_STAGING_FIREBASE_ALIAS",hasFirebaseRc&&/packtook-staging/.test(load(".firebaserc")));
ck("BACKEND_DEPLOY_CODEBASE_OWNERSHIP_ATTESTED",ev.backend_codebase_owner_verified===true);
ck("STATUS_FUNCTION_REVISIONS_PINNED",ev.status_revisions_verified===true);
ck("FIREBASE_APP_CHECK_REGISTRATION_VERIFIED",ev.appcheck_registration_verified===true);
ck("AUTH_APP_CHECK_E2E_VERIFIED",ev.staging_e2e_verified===true);
ck("MONITORING_ROLLBACK_APPROVED",ev.rollback_and_monitoring_approved===true);
ck("P116_HOSTING_BYTES_MATCH_REVIEW",ev.hosted_source_matches_candidate===true);
ck("PUBLIC_SIGNUP_REMAINS_CLOSED",ev.public_signup_closed_verified===true);
ck("OWNER_STAGING_DEPLOY_APPROVAL",ev.owner_staging_deploy_approval===true);
const nonprodOnly=ev.production_deploy_authorized!==true;
ck("PRODUCTION_DEPLOY_NOT_AUTHORIZED",nonprodOnly);
const blocked=checks.filter(x=>!x.pass).map(x=>x.label);
console.log("P117_CHECKS="+checks.filter(x=>x.pass).length+"/"+checks.length);
console.log("P117_BLOCKERS="+blocked.join(","));
const decision=blocked.length?"NO_GO_STAGING":"READY_FOR_INDEPENDENT_REVIEW_NOT_DEPLOY_APPROVED";
console.log("P117_DECISION="+decision);
console.log("P117_CLOUD_CALLS=0 P117_DEPLOYMENTS=0 P117_GITHUB_WRITES=0");
if(ev.project_id!=="packtook-staging" || ev.p116_run_id!==44559986676 || ev.p116_drift_count!==3 || ev.p116_source_match_count!==0) {
 console.error("P117_EVIDENCE_DRIFT");process.exitCode=2;
}else if (decision!=="NO_GO_STAGING") {
 // Safe default. This test must never become an implicit deployment authorization.
 console.error("P117_UNEXPECTED_GO_STATE_REQUIRES_GATE_REVIEW");process.exitCode=3;
}
