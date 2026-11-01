// PACKTOOK V6.1.1 regression check: preserve Firebase UID in auth -> recording flow.
// Lightweight source-level smoke test; runtime browser E2E still required.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const dir=path.dirname(fileURLToPath(import.meta.url));
const app=fs.readFileSync(path.join(dir,"../app/app.js"),"utf8");
const index=fs.readFileSync(path.join(dir,"../app/index.html"),"utf8");
const assert=(ok,msg)=>{if(!ok)throw new Error("Auth pending regression: "+msg)};
assert(!/remoteUser\s*=\s*true\s*;/.test(app),"a boolean is being assigned to remoteUser");
assert(app.includes("const signedInUser=await credit().login("),"login must hold authenticated Firebase user");
assert(app.includes("remoteUser=signedInUser"),"login must preserve Firebase User object");
assert(app.includes("if(!signedInUser?.uid)throw Error("),"login must reject missing uid");
assert(app.includes("if(!remoteUser?.uid||!credit())return toast("),"recording must require a UID");
assert(app.includes("const key=pendingKey();if(!key)throw Error("),"pending operation must fail closed with missing UID");
const m=app.match(/const pendingKey=\(\)=>([^;]+);/);
assert(!!m,"pendingKey helper missing");
const pendingKeyFor=new Function("remoteUser","return "+m[1]);
const expected="test-uid-123";
assert(pendingKeyFor({uid:expected})==="packtook-pending-"+expected,"pending key must be UID scoped");
assert(pendingKeyFor(true)===null,"boolean session must not generate a key");
assert(pendingKeyFor(null)===null,"logged-out session must not generate a key");
// Keep this test forward-compatible with later Customer UI releases.
const scriptVersion=index.match(/<script\\s+src="app\\.js\\?v=(\\d+)\\.(\\d+)\\.(\\d+)"\\s*><\\/script>/);
assert(!!scriptVersion,"app.js script must include a semver cache-busting query parameter");
const [major,minor,patch]=scriptVersion.slice(1).map(Number);
assert(major>6||(major===6&&(minor>1||(minor===1&&patch>=1))),"app.js cache version must be at least 6.1.1");
console.log("PASS: PACKTOOK Firebase UID login/pending regression checks (app.js v"+[major,minor,patch].join(".")+")");
