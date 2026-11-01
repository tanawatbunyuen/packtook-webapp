// PACKTOOK V6.0 static checks. No production secrets; no staging SDK references.
"use strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const id=process.argv[2];
const assert=(c,m)=>{if(!c)throw Error("V6.0 verify: "+m)};
assert(/^[a-z][a-z0-9-]{5,29}$/.test(id||""),"Missing or invalid Production project ID");
assert(id!=="packtook-staging"&&id.includes("prod"),"Production ID must contain prod and differ from packtook-staging");
const cfg=JSON.parse(fs.readFileSync(path.join(root,"firebase.json"),"utf8"));
assert(Array.isArray(cfg.hosting)&&cfg.hosting.length===3,"Expected 3 isolated production Hosting sites");
const targets=cfg.hosting.map(h=>h.target).sort().join(",");
assert(targets==="app,marketing,owner","Unexpected hosting targets");
const pub=cfg.hosting.find(h=>h.target==="marketing");
assert(pub.public==="public","Public marketing directory changed");
for(const h of cfg.hosting)assert(h.public!=="."
&& !h.public.startsWith("../") && fs.existsSync(path.join(root,h.public,"index.html")),"Missing/unsafe site directory "+h.target);
for(const dir of ["public","app","owner"]){
 const html=fs.readFileSync(path.join(root,dir,"index.html"),"utf8");
 assert(!/packtook-staging|firebase-staging|skey_test_|pkey_test_|omise_secret|AIzaSyCps_3b60/i.test(html),"Staging identifier or key in production "+dir);
 if(dir!=="public")assert(/noindex/i.test(html),"Private app/owner holding pages must not be indexed");
}
const runtime=fs.readFileSync(path.join(root,"app","runtime-config.js"),"utf8");
assert(/enabled:\s*false/.test(runtime)&&/registrationEnabled:\s*false/.test(runtime)&&/policiesApproved:\s*false/.test(runtime),"V6.0 auth/registration must remain disabled");
const publicHTML=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
assert(/REGISTRATION & PAYMENT NOT OPEN/.test(publicHTML),"Marketing must say payment is unavailable");
assert(/noindex/i.test(publicHTML),"Prelaunch should not be indexed");
assert(Array.isArray(cfg.functions)&&cfg.functions.length===1,"V6.1 requires exactly one isolated Functions codebase");
assert(cfg.functions[0].source==="functions"&&cfg.functions[0].codebase==="beta","Unexpected Production Functions mapping");
const backend=fs.readFileSync(path.join(root,"functions","index.js"),"utf8");
assert(backend.includes("packtookProductionBeta")&&backend.includes("PACKTOOK_PRODUCTION_PROJECT_ID"),"Missing Production Beta server-side authorization gates");
assert(!/exports\.(?:createOmisePayment|omisePaymentWebhook|omisePaymentStatus|requestPlanChange|ownerAnalyticsSummary)\s*=/.test(backend),"Production Beta exposes payment or owner API");
assert(!/OMISE_SECRET_KEY|skey_test_|skey_live_/i.test(backend),"Production Beta must not load Omise payment secrets");
const appHTML=fs.readFileSync(path.join(root,"app","index.html"),"utf8");
assert(appHTML.includes("PRODUCTION BETA")&&appHTML.includes("mascot-eagle.svg"),"Staging-derived Customer UI missing");
const betaBridge=fs.readFileSync(path.join(root,"app","firebase-packing-bridge.js"),"utf8");
assert(betaBridge.includes('EXPECTED_PROD="packtook-prod-01"'),"Customer Firebase bridge not restricted to Production");
const camera=cfg.hosting.find(h=>h.target==="app").headers.some(h=>h.headers.some(x=>x.key==="Permissions-Policy"&&x.value.includes("camera=(self)")));
assert(camera,"Customer camera must be permitted for same origin");
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
assert(/allow read, write: if false/.test(rules),"Production Firestore must be fail-closed");
console.log("PACKTOOK V6.0 static isolation checks: PASS for",id);
