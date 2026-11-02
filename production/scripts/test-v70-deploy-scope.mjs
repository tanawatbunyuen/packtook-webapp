// V7.0 — offline deployment scope safety regression.
import assert from "node:assert/strict";
import fs from "node:fs";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const script=read("scripts/deploy-v70-qa-controlled.sh");
const emulator=read("scripts/run-v70-emulators.sh");
const source=read("functions/index.js"),qa=read("app/qa-free.js");
assert(script.includes('PROJECT="packtook-prod-01"'));
assert(script.includes('--only "$ONLY_CORE" --non-interactive'));
assert(script.includes('--only "$ONLY_SUPPORT" --non-interactive'));
const lists=[...script.matchAll(/ONLY_(?:CORE|SUPPORT)="([^"]+)"/g)];
assert.equal(lists.length,2,"Expected two explicit scoped deploy batches");
for(const list of lists)assert(list[1].split(",").length<=10,"Do not deploy >10 functions per batch");
assert.equal(new Set(lists.flatMap(x=>x[1].split(","))).size,14,
 "Expected exactly 14 unique named beta callable targets");
assert(script.includes('node scripts/check-v70-qa-preflight.mjs "$PROJECT" "$MODE"'));
assert(script.includes('bash scripts/prepare-v70-qa-disabled.sh "$PROJECT" --qa-off'),
 "QA-disabled Production deploy must snapshot existing functions first");
assert(script.includes('read -r -p "Type $EXPECT'));
assert(script.includes("DEPLOY-V70-QA-DISABLED")&&
 script.includes("DEPLOY-V70-APPROVED-INVITE"));
assert(script.includes("functions:beta:qaFreeStatus")&&
 script.includes("functions:beta:completeQaFreeSignup"));
for(const needed of ["usageStatus","reserveCredit","finalizeCredit",
 "registerDevice","deviceStatus","recordingStatus","accountRole"]){
 assert(script.includes("functions:beta:"+needed),"Critical QA/Beta callable omitted: "+needed);
}
assert(!script.includes("hosting:marketing")&&
 !script.includes("functions:promptpay")&&
 !script.includes("functions:owner"));
assert(!/\bfirebase deploy\b(?![\s\S]*--only)/.test(script));
assert(emulator.includes('DEMO="demo-packtook-v70"')&&
 emulator.includes("--only auth,firestore")&&!emulator.includes("firebase deploy"));
assert(source.includes("!PUBLIC_ACCESS_ENABLED&&!PUBLIC_POLICIES_APPROVED")&&
 source.includes("!PUBLIC_SIGNUP_ENABLED&&"));
assert(!qa.includes("createUserWithEmailAndPassword"));
console.log("PASS: scoped Beta callable deploy, typed approvals, public flags OFF and no billing/owner/marketing");
console.log("PASS: emulator is demo-only and QA page cannot create arbitrary Firebase Auth users");
console.log("RESULT: PACKTOOK V7.0 QA DEPLOY SCOPE SAFETY PASS (no deployment).");
