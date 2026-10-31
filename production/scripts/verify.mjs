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
const publicHTML=fs.readFileSync(path.join(root,"public","index.html"),"utf8");
assert(/REGISTRATION & PAYMENT NOT OPEN/.test(publicHTML),"Marketing must say payment is unavailable");
assert(/noindex/i.test(publicHTML),"Prelaunch should not be indexed");
assert(!cfg.functions,"V6.0 must not deploy staging functions");
const rules=fs.readFileSync(path.join(root,"firestore.rules"),"utf8");
assert(/allow read, write: if false/.test(rules),"Production Firestore must be fail-closed");
console.log("PACKTOOK V6.0 static isolation checks: PASS for",id);
