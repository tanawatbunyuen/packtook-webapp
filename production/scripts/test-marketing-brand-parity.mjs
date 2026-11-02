// PACKTOOK V6.5.2 — CI / Brand parity with the real Customer UI.
// Pure read-only source checks. No Firebase requests and no credentials.
import assert from "node:assert/strict";
import fs from "node:fs";
const load=name=>fs.readFileSync(new URL("../"+name,import.meta.url),"utf8");
const customerCSS=load("app/style.css");
const customerHTML=load("app/index.html");
const customerLogo=load("app/logo.svg");
const customerMascot=load("app/mascot-eagle.svg");
const siteHTML=load("public/index.html");
const brandCSS=load("public/assets/customer-brand.css");
const siteCSS=load("public/assets/site.css");
const marketingLogo=load("public/assets/logo.svg");
const marketingMascot=load("public/assets/mascot-eagle.svg");

// Use exactly the approved Customer brand assets; never redraw or use lookalikes.
assert.equal(customerLogo,marketingLogo,"PACKTOOK marketing must use exact Customer logo SVG");
assert.equal(customerMascot,marketingMascot,"Marketing must use the exact Customer eagle mascot SVG");
assert.match(customerHTML,/packtook-lockup-light/);
assert.match(customerHTML,/packtook-mark/);
assert.match(customerHTML,/packtook-type/);
assert.match(customerHTML,/eagle-tip eagle-hero/);
assert.match(siteHTML,/wordmark packtook-lockup packtook-lockup-light/);
assert.match(siteHTML,/class="packtook-mark"/);
assert.match(siteHTML,/class="packtook-type"/);
assert.match(siteHTML,/eagle-tip eagle-hero/);
assert.match(siteHTML,/สายตาอินทรี มั่นใจทุกออเดอร์/);
assert.match(siteHTML,/บันทึกทุกการแพ็กสินค้า/);
assert.match(siteHTML,/อย่างมืออาชีพ/);
console.log("PASS: real Customer logo, mascot, lockup, headline and eagle messaging");

// Compare known canonical CSS colors from the Customer app to the Marketing brand layer.
const colors=[
 ["Navy","#071632"],["Blue","#096bfa"],["Cyan","#08b7eb"],
 ["Ink","#102449"],["Canvas","#f4f7fc"],["White","#ffffff"],
];
for(const [name,color] of colors){
 assert(customerCSS.toLowerCase().includes(color),"Customer app missing "+name+" "+color);
 assert(brandCSS.toLowerCase().includes(color),"Marketing brand missing "+name+" "+color);
}
const customerFont=customerCSS.match(/^:root\{font-family:([^;]+);/);
assert(customerFont&&brandCSS.includes("font-family:"+customerFont[1]+";"),
 "Marketing font stack must match Customer CSS exactly");
assert(brandCSS.includes("linear-gradient(115deg,#00a6f2,#2250ef)"),
 "Marketing CTA must use Customer login primary button gradient");
assert(customerCSS.includes("linear-gradient(115deg,#00a6f2,#2250ef)"),
 "Customer primary login gradient changed; update Marketing CI");
assert(brandCSS.includes("background:linear-gradient(175deg,#091936,#0b2b59)"),
 "Mock sidebar should look like Customer sidebar");
assert(customerCSS.includes("linear-gradient(175deg,#091936,#0b2b59)"),
 "Customer sidebar background changed; update Marketing CI");
assert(brandCSS.includes("background:#f4f7fc"),
 "Marketing must have the same pale dashboard canvas");
assert(brandCSS.includes("background:#fff"),
 "Marketing panels must be white like Customer panels");
assert(brandCSS.includes(".eagle-tip.eagle-hero"),
 "Eagle hero callout must match Customer");
console.log("PASS: Customer colors, blue CTA, dark sidebar, light canvas and white cards");

// Show a visual analog, never fake a real recording.
assert(siteHTML.includes('data-mock="customer-dashboard"'));
assert(siteHTML.includes("ภาพจำลองเพื่ออธิบายการทำงาน"));
assert(siteHTML.includes('src="/assets/mascot-eagle.svg"'));
assert(siteHTML.includes('src="/assets/logo.svg"'));
assert(siteHTML.includes('customer-brand.css?v=6.5.2'));
assert(siteHTML.includes('site.css?v=6.5.1'));
assert(siteCSS.includes("@media(max-width:640px)")&&
 brandCSS.includes("@media(max-width:640px)"));
assert(brandCSS.includes("@media(max-width:980px)"));
assert(brandCSS.includes("prefers-reduced-motion:reduce"));
assert(siteHTML.includes("REGISTRATION &amp; PAYMENT NOT OPEN")&&
 siteHTML.includes('name="robots" content="noindex, nofollow"'),
 "CI-only deployment must not open public payments/registration");
assert(!/skey_live_|skey_test_|packtook-staging|firebase-staging/.test(siteHTML+brandCSS),
 "Marketing should not leak payment or staging credentials");
console.log("PASS: customer-like mockup, responsive brand layer, and prelaunch safety");
console.log("RESULT: PACKTOOK V6.5.2 Marketing and Customer CI parity source checks PASS.");
