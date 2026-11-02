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
assert.equal((section.match(/<figure class="step-photo">/g)||[]).length,4);
assert.equal((section.match(/loading="lazy"/g)||[]).length,4);
assert.equal((section.match(/decoding="async"/g)||[]).length,4);
assert.equal((section.match(/width="720" height="540"/g)||[]).length,4);
assert(!section.includes('class="step-illustration"'),"Legacy icons must be replaced");
assert(!section.includes('class="step-rec"'),"Legacy REC icon must be replaced");
const expected=[
 ["ready","01","READY","เลือกโฟลเดอร์และเปิดกล้อง","902193ef7841b5379739638021c8bd88d039ab457a298b7ae094c75f35cefca8"],
 ["scan","02","START","สแกนบาร์โค้ดออเดอร์","9cf9ac56b81b96b1487ab85ae93d649a7125ff93cc5cb932838ce5ae49473328"],
 ["save","03","STOP","แพ็กเสร็จ แล้วสแกนซ้ำ","5f1e7824fa76878c72ec408cf757c1c635d61c7d9ad66985979dd66912110b6d"],
 ["review","04","REVIEW","ค้นหาและเปิดวิดีโอย้อนหลัง","16b172f849d427144308e8b3086b503443633e66ef54d0aa6db4d30dcc0e0ebf"]
];
for(const [slug,number,state,title,sha] of expected){
 const path="public/assets/howto-"+slug+".webp";
 const data=read(path);
 assert(data.length>20000&&data.length<110000,path+" should be optimized for web");
 assert.equal(data.toString("ascii",0,4),"RIFF",path+" needs valid RIFF");
 assert.equal(data.toString("ascii",8,12),"WEBP",path+" needs valid WebP signature");
 assert.equal(crypto.createHash("sha256").update(data).digest("hex"),sha,path+" hash mismatch");
 const expression=new RegExp('<article class="step-card"><div class="step-number">'+number+'<span> / '+state+'<\\/span><\\/div><figure class="step-photo"><img src="\\/assets\\/howto-'+slug+'\\.webp\\?v=6\\.5\\.5" alt="([^"]+)"','u');
 const match=section.match(expression);
 assert(match,"Wrong image/step mapping for "+slug);
 assert(match[1].length>50,"Image needs a meaningful alt description: "+slug);
 assert(section.includes("<h3>"+title+"</h3>"),"Missing original step title: "+title);
 console.log("PASS: "+number+" "+state+" — real-look optimized photo, correct title, alt and SHA-256");
}
assert(section.includes("ภาพตัวอย่างประกอบจาก Generative AI"),"AI-created photos must be disclosed");
assert(css.includes(".how-section .step-photo")&&css.includes("object-fit:cover"));
assert(css.includes("@media(max-width:980px)")&&css.includes("@media(max-width:640px)"));
assert(css.includes("display:flex")&&css.includes("flex-direction:column"),"Mobile cards must show usable full-width photos");
assert(html.includes('name="robots" content="noindex, nofollow"'));
assert(html.includes("REGISTRATION &amp; PAYMENT NOT OPEN"),"No public registration/payment");
console.log("RESULT: PACKTOOK V6.5.5 4 real-look photos, responsive cards and prelaunch protections PASS.");
