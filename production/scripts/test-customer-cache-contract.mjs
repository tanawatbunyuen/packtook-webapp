// PACKTOOK V6.8.1 — prevent stale Customer JS/CSS cache assertions in old regression suites.
// Read-only, offline. This guards the Customer Hosting pre-deploy checks.
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const read=p=>fs.readFileSync(path.join(ROOT,p),"utf8");
const html=read("app/index.html");
const linkedJs=html.match(/<script src="app[.]js[?]v=([0-9]+[.][0-9]+[.][0-9]+)"><\/script>/)?.[1];
const linkedCss=html.match(/<link rel="stylesheet" href="style[.]css[?]v=([0-9]+[.][0-9]+[.][0-9]+)">/)?.[1];
if(!linkedJs||!linkedCss)throw Error("Customer cache contract: app.js/style.css versioned links missing");
const customerSuites=[
 "test-customer-ui.mjs","test-promptpay.mjs","test-renewal-notice.mjs",
 "test-qr-lifecycle.mjs","test-onboarding-ui.mjs",
 "test-public-signup-navigation.mjs","test-free-deployment-probe.mjs"
];
for(const file of customerSuites){
 const source=read("scripts/"+file);
 const jsVersions=[...source.matchAll(/app[.]js[?]v=([0-9]+[.][0-9]+[.][0-9]+)/g)].map(m=>m[1]);
 const cssVersions=[...source.matchAll(/style[.]css[?]v=([0-9]+[.][0-9]+[.][0-9]+)/g)].map(m=>m[1]);
 if(jsVersions.some(v=>v!==linkedJs)||cssVersions.some(v=>v!==linkedCss))
  throw Error("Customer cache contract: stale version in "+file+
   " (HTML app.js="+linkedJs+", style.css="+linkedCss+")");
}
if(!html.includes("OMISE PROMPTPAY QR TEST MODE"))
 throw Error("Customer cache contract: original Beta/Test Mode banner disappeared");
console.log("PASS: Customer source links app.js v"+linkedJs+" + style.css v"+linkedCss);
console.log("PASS: "+customerSuites.length+" Customer regression suites reference only current linked assets");
console.log("PASS: prelaunch Omise PromptPay Test Mode banner is preserved");
