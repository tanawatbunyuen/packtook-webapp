// PACKTOOK V6.5.1 — Marketing/prelaunch website QA.
// Offline, read-only; does not use Firebase, customer records, or payment credentials.
// Run from production/: node scripts/test-marketing-website.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const load=(p)=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=load("public/index.html");
const css=load("public/assets/site.css");
const js=load("public/assets/site.js");
const robots=load("public/robots.txt");
const firebase=JSON.parse(load("firebase.json"));
const payment=load("payment-functions/index.js");

assert.match(html,/<html lang="th">/);
assert.match(html,/<meta name="description" content="[^"]{70,}"/);
assert.match(html,/<title>PACKTOOK \|/);
assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
assert.match(robots,/Disallow:\s*\//);
assert.match(html,/REGISTRATION &amp; PAYMENT NOT OPEN/);
assert.match(html,/ยังไม่เปิดรับสมัครหรือชำระเงินจริง/);
assert.match(html,/OMISE|Omise TEST Mode/);
assert(!/packtook-staging|firebase-staging|skey_live_|skey_test_|apiKey\s*=/.test(html+css+js),
 "Marketing must not expose Staging or private credentials");
assert(!/<form[\s>]/.test(html),"Prelaunch marketing must not imply a working waitlist");
assert(!/href=["'](?:https?:\/\/)?(?:buy|pay|checkout)/i.test(html),
 "Prelaunch must not advertise live payment checkout");
console.log("PASS: prelaunch copy, metadata, crawl block, privacy and payment safety");

for(const [id,label] of [
 ["features","features"],["how-it-works","how it works"],["who-its-for","who it's for"],
 ["pricing","pricing"],["faq","FAQ"],["launch","launch"]]){
 assert(html.includes('id="'+id+'"'),"Missing landing section "+label);
}
assert(html.includes('id="heroTitle"'));
assert(html.includes('id="menuToggle"')&&html.includes('aria-controls="mainNav"')&&
 html.includes('aria-expanded="false"')&&html.includes('id="mainNav"'));
assert(html.includes('class="skip-link"')&&html.includes('href="#content"'));
assert(html.includes('id="year"'));
for(const anchor of html.matchAll(/href="#([A-Za-z0-9_-]+)"/g)){
 assert(html.includes('id="'+anchor[1]+'"'),"Broken in-page link #"+anchor[1]);
}
assert(html.includes('/assets/logo.svg')&&html.includes('/assets/mascot-eagle.svg'));
assert(html.includes('ภาพจำลองเพื่ออธิบายการทำงาน'));
assert(html.includes('site.css?v=6.5.1')&&html.includes('site.js?v=6.5.1'));
assert.equal((html.match(/<details>/g)||[]).length,7);
console.log("PASS: sections, in-page navigation, 7 native FAQs, accessibility and assets");

const names=["Free","Starter","Basic","Growth","Business","Pro"];
const planFields=(regex)=>{
 const match=payment.match(regex);
 assert(match,"Cannot find canonical Payment Functions pricing fields");
 return Object.fromEntries([...match[1].matchAll(/([A-Za-z]+):(\d+|null)/g)].map(m=>[m[1],m[2]==="null"?null:Number(m[2])]));
};
const limits=planFields(/const limits=\{([^}]+)\}/);
const prices=planFields(/const pricesTHB=\{([^}]+)\}/);
const devices=planFields(/const deviceLimits=\{([^}]+)\}/);
const cards=[...html.matchAll(/<article class="price-card(?: highlight)?">([\s\S]*?)<\/article>/g)].map(x=>x[1]);
assert.equal(cards.length,6,"All six payment-function plans must appear in marketing");
for(let i=0;i<names.length;i++){
 const name=names[i],card=cards[i],price=prices[name],amount=limits[name];
 assert(card.includes("<h3>"+name+"</h3>"),"Plan order/name mismatch "+name);
 assert(card.includes(price.toLocaleString("en-US")),"Test price mismatch "+name);
 assert(card.includes(amount===null?"<strong>∞</strong>":"<strong>"+amount.toLocaleString("en-US")+"</strong>"),
 "Video credit amount mismatch "+name);
 assert(card.includes("ลงทะเบียน"+(devices[name]===1?" 1 อุปกรณ์":"ได้ "+devices[name]+" อุปกรณ์")),
 "Device allowance mismatch "+name);
 assert(card.includes("ยังไม่เปิดรับชำระ")||card.includes("เตรียมเปิดรับสมัคร"),
 "No paid checkout / signup should be promised before launch");
}
assert(html.includes("ระบบทดสอบ ณ V6.5")&&html.includes("ราคาและเงื่อนไขอาจเปลี่ยน"));
console.log("PASS: six plans match backend amount, device limit and price; prices marked preliminary");

const hosts=firebase.hosting;
assert(hosts.length===3);
const marketing=hosts.find(x=>x.target==="marketing");
assert(marketing?.public==="public");
assert(hosts.find(x=>x.target==="app")?.public==="app");
assert(hosts.find(x=>x.target==="owner")?.public==="owner");
assert(css.includes("@media(max-width:640px)")&&css.includes("@media(max-width:980px)"));
assert(css.includes("prefers-reduced-motion:reduce"));
assert(css.includes(":focus-visible"));
new vm.Script(js,{filename:"public/assets/site.js"});
console.log("PASS: isolated marketing hosting, responsive CSS, focus states and JS parsing");

// Simulate mobile nav interactions without a browser/network.
const handlers={};
const attrs=new Map([["aria-expanded","false"]]);
const navClasses=new Set();
let focused=false;
const button={
 getAttribute:key=>attrs.get(key),
 setAttribute:(key,val)=>attrs.set(key,val),
 addEventListener:(key,fn)=>handlers["toggle:"+key]=fn,
 contains:target=>target==="toggle",
 focus:()=>{focused=true}
};
const nav={
 classList:{toggle:(cls,on)=>on?navClasses.add(cls):navClasses.delete(cls)},
 querySelectorAll:()=>[{addEventListener:(key,fn)=>handlers["link:"+key]=fn}],
 contains:target=>target==="nav"
};
const document={
 getElementById:id=>id==="menuToggle"?button:id==="mainNav"?nav:id==="year"?{set textContent(_x){}}:null,
 addEventListener:(key,fn)=>handlers["document:"+key]=fn
};
const window={matchMedia:()=>({matches:false,addEventListener:(key,fn)=>handlers["wide:"+key]=fn})};
vm.runInNewContext(js,{document,window,Date},{timeout:500});
handlers["toggle:click"]();
assert.equal(attrs.get("aria-expanded"),"true");
assert(navClasses.has("nav-open"));
handlers["document:keydown"]({key:"Escape"});
assert.equal(attrs.get("aria-expanded"),"false");
assert(focused);
handlers["toggle:click"]();
handlers["link:click"]();
assert.equal(attrs.get("aria-expanded"),"false");
console.log("PASS: mobile menu opens, closes on ESC and link selection");
console.log("RESULT: PACKTOOK V6.5.1 Marketing prelaunch website offline QA PASS.");
