import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
// Convert firebase apps:sdkconfig WEB <APP_ID> -o output to a client-only config.
// Not a secret, but intentionally kept out of the GitHub repository.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const [project,source]=process.argv.slice(2);
const fail=message=>{console.error("ERROR: "+message);process.exit(1)};
if(project!=="packtook-prod-01")fail("Only the separately provisioned packtook-prod-01 project is permitted.");
if(!source||!fs.existsSync(source))fail("Pass a JSON SDK config file from the Production Firebase Web App");
let cfg;try{cfg=JSON.parse(fs.readFileSync(source,"utf8"))}catch{fail("SDK config file must be valid JSON (firebase apps:sdkconfig WEB ... -o path)")}
cfg=cfg.sdkConfig??cfg.result?.sdkConfig??cfg.result??cfg;
if(cfg.projectId!==project||cfg.authDomain!==project+".firebaseapp.com")fail("The SDK config points to a different Firebase project");
if(typeof cfg.apiKey!=="string"||cfg.apiKey.length<20||typeof cfg.appId!=="string"||cfg.appId.length<15)fail("Missing Firebase apiKey or appId");
if(typeof cfg.messagingSenderId!=="string"||!/^\d+$/.test(cfg.messagingSenderId))fail("Missing Firebase messagingSenderId");
const keys=["apiKey","authDomain","projectId","appId","messagingSenderId","storageBucket","measurementId"];
const publicCfg=Object.fromEntries(keys.filter(k=>typeof cfg[k]==="string").map(k=>[k,cfg[k]]));
const dest=path.join(root,"app","firebase-v4-config.js");
const content="// PACKTOOK V6.1 Production Beta; generated from Production Firebase Web App.\n"+
 "export const firebaseConfig = "+JSON.stringify(publicCfg,null,2)+";\n";
fs.writeFileSync(dest,content,{mode:0o600});
console.log("Production Web config created:",dest);
console.log("Verified Firebase project:",project);
console.log("No config from packtook-staging was copied.");
