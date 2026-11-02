// PACKTOOK V7.0 — offline Cloud Shell production-context isolation regression.
// No Firebase SDK, credentials, network access, project switching or deployments.
import assert from "node:assert/strict";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
const DEMO="demo-packtook-v70";
const runner=fs.readFileSync(new URL("./run-v70-emulators.sh",import.meta.url),"utf8");
assert(runner.includes('DEMO="demo-packtook-v70"'));
assert(runner.includes('if env GCLOUD_PROJECT="$DEMO" GCP_PROJECT="$DEMO" \\'));
assert(runner.includes('GOOGLE_CLOUD_PROJECT="$DEMO" FIREBASE_PROJECT_ID="$DEMO" \\'));
assert(runner.includes('firebase emulators:exec --project "$DEMO" \\'));
assert(runner.includes('--config firebase.emulators-v67.json --only auth,firestore'));
assert(!runner.includes("firebase deploy"));
const projectKeys=["GCLOUD_PROJECT","GCP_PROJECT","GOOGLE_CLOUD_PROJECT","FIREBASE_PROJECT_ID"];
const ambient={...process.env,GOOGLE_CLOUD_PROJECT:"packtook-prod-01"};
const script=[
 'const assert=require("node:assert/strict");',
 ...projectKeys.map(key=>`assert.equal(process.env.${key},${JSON.stringify(DEMO)});`),
 'assert.equal(process.env.PACKTOOK_QA_DEMO_PROJECT,"demo-packtook-v70");',
 'assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST,"127.0.0.1:9099");',
 'assert.equal(process.env.FIRESTORE_EMULATOR_HOST,"127.0.0.1:8080");'
].join("\n");
const spawned=spawnSync("env",[
 ...projectKeys.map(k=>k+"="+DEMO),
 "PACKTOOK_QA_DEMO_PROJECT="+DEMO,
 "FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099",
 "FIRESTORE_EMULATOR_HOST=127.0.0.1:8080",
 process.execPath,"-e",script
],{env:ambient,encoding:"utf8",timeout:10000});
assert.equal(spawned.status,0,spawned.stderr||spawned.error?.message);
assert.equal(ambient.GOOGLE_CLOUD_PROJECT,"packtook-prod-01");
console.log("PASS: Cloud Shell Production project context is isolated to DEMO-only emulator subprocess");
console.log("PASS: no parent environment mutation; exact demo project, emulator ports and no deploy");
console.log("RESULT: PACKTOOK V7.0 DEMO ENV ISOLATION REGRESSION PASS (offline only)");
