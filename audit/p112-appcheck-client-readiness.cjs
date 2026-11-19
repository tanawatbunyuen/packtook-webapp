"use strict";
// P112 offline readiness gate. No cloud calls, no credentials, no deployment.
// Usage: node audit/p112-appcheck-client-readiness.cjs
const fs=require("node:fs"), path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const backend=read("functions/index.js");
const bridge=read("firebase-staging/firebase-packing-bridge.js");
const config=read("firebase-staging/firebase-v4-config.js");
const html=read("firebase-staging/index.html");
const checks=[];
function check(label,passed,critical=true){checks.push({label,passed:!!passed,critical});console.log((passed?"PASS ":"BLOCK ")+label);}
const options=backend.match(/const statusOptions\s*=\s*(\{[^;]+\})/);
check("BACKEND_SCOPED_ENFORCEMENT",/enforceAppCheck\s*:\s*true/.test(options?.[1]||""));
for(const n of ["recordingStatus","usageStatus"]){
  const m=backend.match(new RegExp("exports\\."+n+"\\s*=\\s*onCall\\(statusOptions,async req=>\\{([\\s\\S]*?)\\n\\}\\);"));
  check(n+"_OPTIONS_AND_VERIFIED_UID",!!m&&/\buid\(req\)/.test(m[1]));
}
check("CLIENT_IMPORTS_APP_CHECK_SDK",/firebase-app-check\.js/.test(bridge));
check("CLIENT_INITIALIZES_ENTERPRISE",/initializeAppCheck\s*\(/.test(bridge)&&/new\s+ReCaptchaEnterpriseProvider\s*\(/.test(bridge));
check("CLIENT_AUTO_REFRESH",/isTokenAutoRefreshEnabled\s*:\s*true/.test(bridge));
check("CLIENT_HAS_STAGING_SITE_KEY_BINDING",/recaptchaEnterpriseSiteKey/.test(config)&&/recaptchaEnterpriseSiteKey/.test(bridge));
check("CLIENT_BRIDGE_LOADED",/firebase-packing-bridge\.js/.test(html));
check("CLIENT_STATUS_CALLS_PROTECTED",/protectedApi\(["']usageStatus["']\)/.test(bridge)&&/protectedApi\(["']recordingStatus["']\)/.test(bridge));
check("STAGING_SITE_KEY_PROVISIONED",/export const recaptchaEnterpriseSiteKey\\s*=\\s*["\x27][^"\x27]+["\x27]/.test(config));
check("BACKEND_LEGACY_OPTIONS_UNCHANGED",/const options=\{region,maxInstances:20,timeoutSeconds:30\};/.test(backend));
const failed=checks.filter(x=>x.critical&&!x.passed);
console.log("P112_RESULT="+(failed.length?"NO_GO_STAGING":"SOURCE_READY_RUNTIME_UNVERIFIED"));
console.log("P112_COUNTS="+checks.filter(x=>x.passed).length+"/"+checks.length);
console.log("P112_RUNTIME_TEST=NOT_RUN P112_STAGING_DEPLOY=NO P112_PRODUCTION_DEPLOY=NO");
process.exitCode=failed.length?1:0;
