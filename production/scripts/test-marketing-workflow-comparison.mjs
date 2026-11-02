// PACKTOOK V6.5.3 — packing Hero illustration and full pricing comparison QA.
// Offline, read-only. No Firebase, customer data, or network requests.
import fs from "node:fs";
import assert from "node:assert/strict";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("public/index.html");
const css=read("public/assets/packing-comparison.css");
const scene=read("public/assets/packing-workstation.svg");
const prices=read("payment-functions/index.js");
const customerCSS=read("app/style.css");

// Verify Hero is an actual packing workstation, not the previous lone-box mock.
const hero=html.match(/<section class="hero container"[\s\S]*?<\/section>/)?.[0];
assert(hero,"Cannot find the main PACKTOOK Hero");
assert(hero.includes('src="/assets/packing-workstation.svg"')&&hero.includes('data-photo-src="/assets/packtook-hero-photo.webp"'),
 "Hero must load local AI photoreal packing photo with illustration fallback");
assert(hero.includes("พนักงานกำลังแพ็กพัสดุ")&&hero.includes("เครื่องสแกน Barcode")&&hero.includes("PACKTOOK")&&hero.includes("REC"),
 "Hero image needs accessible alt describing worker, scanner and PACKTOOK");
for(const token of ["สแกน Barcode","แพ็ก + REC","สแกนซ้ำ + SAVE"])
 assert(hero.includes(token),"Missing packing process legend: "+token);
assert(!hero.includes('data-mock="customer-dashboard"'),"Legacy lone-box hero should be replaced");
assert(hero.includes("ภาพจำลองจาก Generative AI"),"AI image must not be presented as a real customer recording");
assert(!hero.includes('packing-flow-callout'),"Do not duplicate callouts already embedded in the AI photo");
assert(scene.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
assert(scene.trim().endsWith("</svg>"));
assert(scene.includes("An ecommerce worker packs a parcel"));
assert(scene.includes("Barcode handheld scanner")&&scene.includes("Recording camera suspended above parcel"));
assert(scene.includes("Computer monitor")&&scene.includes("PACKTOOK / PACKING"));
assert(!/<script\b|https?:\/\/|data:|foreignObject/i.test(scene.replace('xmlns="http://www.w3.org/2000/svg"','')),"SVG must be self-contained and script-free");
console.log("PASS: local AI photoreal Hero, packing workflow legend, scanner/camera/PACKTOOK alt and SVG fallback");

assert(html.includes('href="/assets/packing-comparison.css?v=6.5.3"')||
 html.includes('href="/assets/packing-comparison.css?v=6.5.3">'),
 "Versioned comparison CSS asset missing");
assert(html.includes('typography.css?v=6.5.4')&&html.includes('hero-photo.js?v=6.5.4'),
 "Versioned typography and photo loader assets must be present");
assert(css.includes(".packing-scene")&&css.includes(".packing-flow-callout")&&css.includes(".packing-flow-legend"));
assert(css.includes(".comparison-scroll{")&&css.includes("overflow-x:auto"));
assert(css.includes("position:sticky;left:0")&&css.includes(".comparison-table"));
assert(css.includes("@media(max-width:640px)")&&css.includes("@media(max-width:980px)"));
assert(customerCSS.includes("#096bfa")&&css.includes("#096bfa"),"Brand primary blue mismatch");
console.log("PASS: responsive packing visual and accessible horizontal pricing comparison");

const section=html.match(/<section id="pricing"[\s\S]*?<\/section>/)?.[0];
assert(section&&section.includes("<table")&&section.includes("<thead>")&&section.includes("<tbody>"));
assert(!section.includes('class="pricing-grid"')&&!section.includes('class="price-card'),
 "Comparison must replace individual price cards");
assert(section.includes('role="region"')&&section.includes('tabindex="0"')&&section.includes("<caption"),
 "Comparison table must be keyboard accessible");
assert(section.includes('scope="row"')&&section.includes('scope="col"'),
 "Comparison needs row and column headers");
const tiers=["Free","Starter","Basic","Growth","Business","Pro"];
const map=src=>Object.fromEntries([...src.matchAll(/([A-Za-z]+):(\d+|null)/g)]
 .map(x=>[x[1],x[2]==="null"?null:Number(x[2])]));
const limits=map(prices.match(/const limits=\{([^}]+)\}/)?.[1]||"");
const values=map(prices.match(/const pricesTHB=\{([^}]+)\}/)?.[1]||"");
const devices=map(prices.match(/const deviceLimits=\{([^}]+)\}/)?.[1]||"");
const headers=[...section.matchAll(/<th scope="col" class="comparison-plan(?: is-highlighted)?" data-plan="([^"]+)" data-test-price="([^"]+)" data-credits="([^"]+)" data-devices="([^"]+)">/g)];
assert.equal(headers.length,6);
for(let i=0;i<tiers.length;i++){
 const [_,name,cost,qty,deviceCount]=headers[i];
 assert.equal(name,tiers[i],"Tier order");
 assert.equal(Number(cost),values[name],name+" price mismatch");
 assert.equal(qty,limits[name]===null?"unlimited":String(limits[name]),name+" credit mismatch");
 assert.equal(Number(deviceCount),devices[name],name+" device mismatch");
}
const body=section.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1]||"";
const rows=[...body.matchAll(/<tr(?: [^>]*)?>([\s\S]*?)<\/tr>/g)];
assert.equal(rows.length,9,"Expect exact feature comparison rows");
for(const [i,row] of rows.entries()){
 assert.equal((row[1].match(/<td(?: [^>]*)?>/g)||[]).length,6,
  "Row "+(i+1)+" missing some tiers");
 assert.equal((row[1].match(/<th scope="row">/g)||[]).length,1);
}
for(const label of ["สิทธิ์วิดีโอ","จำนวนอุปกรณ์","ระยะเวลาสิทธิ์",
 "สแกน Barcode เริ่ม/หยุด","บันทึกวิดีโอในเครื่อง",
 "ค้นหาใน Dashboard","Help / Troubleshooting","เหมาะสำหรับ","สถานะการเปิดบริการ"])
 assert(body.includes(label),"Missing comparison row "+label);
assert(section.includes("ระบบทดสอบ V6.5")&&section.includes("ไม่ใช่ข้อเสนอขายจริง"));
assert(section.includes("ไม่เปิดสมัครสาธารณะหรือชำระเงินจริง"));
console.log("PASS: all six backend plans and nine feature rows match exact test-mode business rules");
console.log("RESULT: PACKTOOK V6.5.3 Marketing Packing Hero + Comparison QA PASS.");
