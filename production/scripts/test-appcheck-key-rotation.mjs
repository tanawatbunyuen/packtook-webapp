// PACKTOOK V6.9.2 — offline verification of fail-closed App Check key replacement.
import assert from "node:assert/strict";
import fs from "node:fs";
import {checkNewKey} from "./rotate-appcheck-site-key.mjs";
const config=fs.readFileSync(new URL("../app/signup-config.js",import.meta.url),"utf8");
const old=config.match(/appCheckSiteKey:"([^"]*)"/)?.[1];
assert(old&&old.length>30,"Expected current production public site key");
const next="6LdYzfEwAAAAADemoApprovedLocalFixture";
const metadata={name:"projects/packtook-prod-01/keys/"+next,
 displayName:"PACKTOOK-PROD-WEB-V2",
 webSettings:{integrationType:"SCORE",allowedDomains:["packtook-prod-01-app.web.app"],allowAllDomains:false}};
const rotated=checkNewKey({currentConfig:config,newKey:next,metadata});
assert(rotated.content.includes('appCheckSiteKey:"'+next+'"'));
assert(!rotated.content.includes('appCheckSiteKey:"'+old+'"'));
assert(rotated.content.includes('policyVersion:"2026-11-v1"'));
assert.equal(rotated.content.replace(next,old),config);
console.log("PASS: new web score key rotates only public Site Key and preserves other config");
const numberForm={...metadata,name:"projects/123456789012/keys/"+next};
assert(checkNewKey({currentConfig:config,newKey:next,metadata:numberForm,projectNumber:"123456789012"}).content.includes(next));
assert.throws(()=>checkNewKey({currentConfig:config,newKey:next,metadata:numberForm,projectNumber:"987654321098"}),/SAFETY BLOCK/);
console.log("PASS: Production numeric project resource accepted only when independently matched");

const blocked=(label,key=next,meta=metadata)=>{
 assert.throws(()=>checkNewKey({currentConfig:config,newKey:key,metadata:meta}),/SAFETY BLOCK/);
 console.log("PASS: rejected "+label);
};
blocked("same existing key",old);
blocked("truncated key",next+"...");
blocked("wrong project",next,{...metadata,name:"projects/packtook-staging/keys/"+next});
blocked("wrong domain",next,{...metadata,webSettings:{integrationType:"SCORE",allowedDomains:["example.org"]}});
blocked("unrestricted domains",next,{...metadata,webSettings:{integrationType:"SCORE",allowedDomains:["packtook-prod-01-app.web.app"],allowAllDomains:true}});
blocked("checkbox instead of score",next,{...metadata,webSettings:{integrationType:"CHECKBOX",allowedDomains:["packtook-prod-01-app.web.app"]}});
blocked("testing score",next,{...metadata,testingOptions:{testingScore:0.9}});
console.log("RESULT: PACKTOOK V6.9.2 Site Key rotation regression PASS (offline; no Cloud mutation).");
