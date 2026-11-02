// PACKTOOK V6.5.5 — local 4-step photo assets + responsive How It Works regression.
// Read-only/offline; no Firebase, user data, network, or payment calls.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url));
const html=read("public/index.html").toString("utf8");
const css=read("public/assets/howto-photos.css").toString("utf8");
const section=html.match(/<section id="how-it-works"[\s\S]*?<\/section>/)?.[0];
assert(section,"How it works section is missing");
assert(html.includes('<link rel="stylesheet" href="/assets/howto-photos.css?v=6.5.5">'));
assert.equal((section.match(/<article class="step-card">/g)||[]).length,4);
assert.equal((section.match(/<figure class="step-photo" data-angle=/g)||[]).length,4);
assert.equal((section.match(/loading="lazy"/g)||[]).length,4);
assert.equal((section.match(/decoding="async"/g)||[]).length,4);
assert.equal((section.match(/width="720" height="540"/g)||[]).length,4);
assert(!section.includes('class="step-illustration"'),"Legacy icons must be replaced");
assert(!section.includes('class="step-rec"'),"Legacy REC icon must be replaced");
assert(!section.includes('webp?v=6.5.5'),"Old cached photo URLs must not remain");
const angles=[...section.matchAll(/<figure class="step-photo" data-angle="([^"]+)"/g)].map(x=>x[1]);
assert.deepEqual(angles,[
 "over-shoulder-monitor","close-up-barcode-scanner",
 "front-three-quarter-packing","close-up-dashboard-laptop"
],"The four steps must use different camera framing");
assert.equal(new Set(angles).size,4,"Duplicate camera angles not allowed");
const expected=[
 ["ready","01","READY","เลือกโฟลเดอร์และเปิดกล้อง","97bae0391e73676dcf2fe539984980f114deada8ee78b59d7b3ce9335d264a78"],
 ["scan","02","START","สแกนบาร์โค้ดออเดอร์","5a1ca6cba6fd2a1840a74ea9f0fac9102373da13186064b69c27f4593c04bb49"],
 ["save","03","STOP","แพ็กเสร็จ แล้วสแกนซ้ำ","e71b8ec0170ea257f1d8a3963ea9d27cd39be127337f8bbb9311d0c6e7386d39"],
 ["review","04","REVIEW","ค้นหาและเปิดวิดีโอย้อนหลัง","8b291e1d4031c42e308303007aa8c946acce825a0c4815b2aefc107936226377"]
];
for(const [slug,number,state,title,sha] of expected){
 const path="public/assets/howto-"+slug+".webp";
 const data=read(path);
 assert(data.length>20000&&data.length<110000,path+" should be optimized for web");
 assert.equal(data.toString("ascii",0,4),"RIFF",path+" needs valid RIFF");
 assert.equal(data.toString("ascii",8,12),"WEBP",path+" needs valid WebP signature");
 assert.equal(crypto.createHash("sha256").update(data).digest("hex"),sha,path+" hash mismatch");
 const cards=[...section.matchAll(/<article class="step-card">([\s\S]*?)<\/article>/g)].map(x=>x[1]);
 const card=cards.find(x=>x.includes('<div class="step-number">'+number+'<span> / '+state+'</span>'));
 assert(card,"Step card missing "+number);
 assert(card.includes('src="/assets/howto-'+slug+'.webp?v=6.5.6"'),"Wrong image version/step mapping for "+slug);
 const alt=card.match(/<img[^>]* alt="([^"]+)"/)?.[1]||"";
 assert(alt.length>50,"Image needs meaningful Thai alt text: "+slug);
 assert(section.includes("<h3>"+title+"</h3>"),"Missing original step title: "+title);
 console.log("PASS: "+number+" "+state+" — real-look optimized photo, correct title, alt and SHA-256");
}
assert(section.includes("ภาพตัวอย่างประกอบจาก Generative AI"),"AI-created photos must be disclosed");
assert(css.includes(".how-section .step-photo")&&css.includes("object-fit:cover"));
assert(css.includes("@media(max-width:980px)")&&css.includes("@media(max-width:640px)"));
assert(css.includes("display:flex")&&css.includes("flex-direction:column"),"Mobile cards must show usable full-width photos");
assert(html.includes('name="robots" content="noindex, nofollow"'));
assert(html.includes("REGISTRATION &amp; PAYMENT NOT OPEN"),"No public registration/payment");
console.log("RESULT: PACKTOOK V6.5.6 4 distinct camera angles, optimized photo assets, responsive cards and prelaunch protections PASS.");
