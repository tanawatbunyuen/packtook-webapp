// V6.8.1 offline QA — production env and deploy-target controls.
// Never calls Firebase or writes environment files.
import assert from "node:assert/strict";
import fs from "node:fs";
import {evaluateFiles} from "./check-public-status-rollout.mjs";

const safe=[
 "PACKTOOK_PRODUCTION_PROJECT_ID=packtook-prod-01",
 "PACKTOOK_PUBLIC_SIGNUP_ENABLED=false",
 "PACKTOOK_PUBLIC_ACCESS_ENABLED=false",
 "PACKTOOK_PUBLIC_POLICIES_APPROVED=false"
].join("\n")+"\n";
const good=evaluateFiles({".env.packtook-prod-01":safe},{});
assert.equal(good.passed,true);
assert.equal(good.allPublicFlagsOff,true);
assert.equal(good.checks.length,3);
console.log("PASS: explicit 3 OFF flags and matching Production project accepted");

const fails=(label,files,environment={})=>{
 assert.throws(()=>evaluateFiles(files,environment),/SAFETY BLOCK:|Duplicate|unrecognized/i,
  label+" must fail closed");
 console.log("PASS: rejected "+label);
};
fails("missing Functions env",{});
fails("incorrect Production project",{".env.packtook-prod-01":safe.replaceAll("packtook-prod-01","packtook-staging")});
fails("Public signup ON",{".env.packtook-prod-01":safe.replace("PACKTOOK_PUBLIC_SIGNUP_ENABLED=false","PACKTOOK_PUBLIC_SIGNUP_ENABLED=true")});
fails("Public access ON",{".env.packtook-prod-01":safe.replace("PACKTOOK_PUBLIC_ACCESS_ENABLED=false","PACKTOOK_PUBLIC_ACCESS_ENABLED=true")});
fails("policy approval ON",{".env.packtook-prod-01":safe.replace("PACKTOOK_PUBLIC_POLICIES_APPROVED=false","PACKTOOK_PUBLIC_POLICIES_APPROVED=true")});
fails("Public flag omitted",{".env.packtook-prod-01":safe.replace("PACKTOOK_PUBLIC_ACCESS_ENABLED=false","")});
fails("Public flag duplicated",{".env.packtook-prod-01":safe+"\nPACKTOOK_PUBLIC_ACCESS_ENABLED=false"});
fails("shell sets Production Public ON",{".env.packtook-prod-01":safe},{PACKTOOK_PUBLIC_SIGNUP_ENABLED:"true"});
fails("generic env file contains public ON",{
 ".env":"PACKTOOK_PUBLIC_ACCESS_ENABLED=true",
 ".env.packtook-prod-01":safe
});

const rollout=fs.readFileSync(new URL("./deploy-public-status-prelaunch.sh",import.meta.url),"utf8");
assert(rollout.includes('--only functions:beta:publicSignupStatus --non-interactive'),
 "Function deploy target must be scoped to beta:publicSignupStatus");
assert(rollout.includes('read -r -p "Type DEPLOY-READONLY-SIGNUP-STATUS'));
assert(rollout.includes('node scripts/check-public-status-rollout.mjs "$PROJECT"'));
assert(rollout.includes('--project "$PROJECT"'));
assert(!rollout.includes("functions:beta:completeFreeSignup"));
assert(!rollout.includes("firebase deploy --only functions"));
console.log("PASS: targeted read-only STATUS-only deploy command requires explicit owner approval");
console.log("RESULT: PACKTOOK V6.8.1 PRELAUNCH ENV + DEPLOY TARGET SAFETY PASS.");
