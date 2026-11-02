// PACKTOOK V6.5.4 — Marketing typography consistency and photo fallback QA.
// Offline and read-only; no Firebase, network or user data.
import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
const load=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=load("public/index.html");
const css=load("public/assets/typography.css");
const photoJS=load("public/assets/hero-photo.js");
const customerCSS=load("app/style.css");
const baseCSS=load("public/assets/site.css");
const comparisonCSS=load("public/assets/packing-comparison.css");

assert(html.includes("typography.css?v=6.5.4"),"Typography version missing");
assert(html.includes("hero-photo.js?v=6.5.4"),"Photo loader version missing");
assert(html.indexOf("site.css?v=6.5.1")<html.indexOf("customer-brand.css?v=6.5.2"));
assert(html.indexOf("customer-brand.css?v=6.5.2")<html.indexOf("packing-comparison.css?v=6.5.3"));
assert(html.indexOf("packing-comparison.css?v=6.5.3")<html.indexOf("typography.css?v=6.5.4"));
assert(css.includes("--pt-type-nav:15px")&&css.includes("--pt-type-body:16px"));
assert(css.includes("--pt-type-h1:clamp(36px,3.45vw,50px)"));
assert(css.includes("--pt-type-h2:clamp(28px,2.65vw,39px)"));
assert(css.includes("--pt-type-h3:clamp(19px,1.7vw,23px)"));
assert(css.includes(".hero h1{font-size:var(--pt-type-h1)"));
assert(css.includes(".section-heading h2{font-size:var(--pt-type-h2)"));
assert(css.includes(".site-header .main-nav>a{font-size:var(--pt-type-nav)"));
assert(css.includes(".hero-lead{font-size:var(--pt-type-lead)"));
assert(css.includes("@media(max-width:640px)")&&css.includes("@media(max-width:980px)"));
assert(css.includes("--pt-type-h1:clamp(31px,8.3vw,39px)"));
assert(css.includes("--pt-type-h2:clamp(27px,6.9vw,33px)"));
assert(css.includes(".feature-card p{font-size:15px"));
assert(css.includes(".faq-answer{font-size:15px"));
assert(css.includes(".comparison-table{font-size:13px"));
assert(!/font-family:\s*Comic|skey_live_|PACKTOOK_PUBLIC_SIGNUP_ENABLED=true/.test(css));
assert(customerCSS.includes("font-family:Inter"),"Customer font reference not found");
assert(baseCSS.includes(".hero h1")&&comparisonCSS.includes(".comparison-table"));
console.log("PASS: coherent type scale, readable body/nav, responsive headings and CSS cascade");

// Simulate local photo load + failure fallback without network.
const photoElement={
 attributes:new Map([["data-photo-src","/assets/packtook-hero-photo.webp"]]),
 src:"/assets/packing-workstation.svg",
 getAttribute(k){return this.attributes.get(k)}
};
let marked=false;
const document={
 getElementById:id=>id==="heroPackingImage"?photoElement:null,
 documentElement:{classList:{add(c){if(c==="packtook-photo-ready")marked=true}}}
};
let mockImage=null;
class Image{
 constructor(){mockImage=this}
 set src(v){this._src=v}
 get src(){return this._src}
}
new vm.Script(photoJS);
vm.runInNewContext(photoJS,{document,Image},{timeout:300});
assert.equal(mockImage.src,"/assets/packtook-hero-photo.webp");
assert.equal(photoElement.src,"/assets/packing-workstation.svg");
mockImage.onerror();
assert.equal(photoElement.src,"/assets/packing-workstation.svg","No photo should retain SVG fallback");
mockImage.onload();
assert.equal(photoElement.src,"/assets/packtook-hero-photo.webp");
assert(marked,"Successful load should style real Hero photo");
console.log("PASS: photo loader swaps local AI image only when available and keeps SVG fallback if missing");

assert(html.includes("ภาพจำลองจาก Generative AI"),"AI hero must be disclosed");
assert(html.includes('name="robots" content="noindex, nofollow"'));
assert(html.includes("REGISTRATION &amp; PAYMENT NOT OPEN"));
console.log("PASS: AI disclosure and no-public-registration/payment prelaunch status");
console.log("RESULT: PACKTOOK V6.5.4 Typography + AI Hero fallback QA PASS.");
