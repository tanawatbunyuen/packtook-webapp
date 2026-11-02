// PACKTOOK V6.4.2 — test 7-day in-app renewal warning and same-tier purchase state.
// Static/runtime browser-free checks; no writes to Production Firebase.
import fs from "node:fs";
const js=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/style.css",import.meta.url),"utf8");
const assert=(yes,msg)=>{if(!yes)throw Error("V6.4.2 notice test: "+msg)};
assert(html.includes('id="subscriptionExpiryAlert"')&&html.includes('id="renewFromAlert"')&&html.includes('id="expiryAlertText"'),
 "Global notification banner and renewal CTA must exist in Customer App");
assert(html.includes('app.js?v=6.4.3')&&html.includes('style.css?v=6.4.3'),
 "Client app/stylesheet assets need V6.4.2 cache bust");
assert(css.includes('.subscription-expiry-alert[hidden]'),"Hidden notice must not occupy screen space");
assert(js.includes("showTab('plans');$('availablePlans')?.scrollIntoView"),"Notification CTA must navigate to Packages");
assert(!js.includes("q?.subscriptionStatus==='active'&&q?.canBuyMore"),
 "Renewal alert must not depend on obsolete canBuyMore=false");
const start=js.indexOf("// V6.4.2 — 7-day on-screen renewal notice");
const end=js.indexOf("function updateUsersSummary(){",start);
assert(start>=0&&end>start,"Renewal notice helper not found");
const code=js.slice(start,end);
const now=Date.now(),day=86400000;
const iso=ms=>new Date(now+ms).toISOString();
const active=(ms,plan="Starter")=>({plan,subscriptionStatus:"active",planExpiresAt:iso(ms)});
const banner={hidden:true},copy={textContent:""};
const nodes={subscriptionExpiryAlert:banner,expiryAlertText:copy};
const instance=new Function("$","firstQuota",code+
 "\nlet remoteQuota=firstQuota;return {expiryReminder,updateRenewalNotice,setQuota:q=>{remoteQuota=q}};"
 )(id=>nodes[id],active(6*day));
assert(instance.expiryReminder(active(8*day),now)===null,"8 days remaining must not alert");
assert(instance.expiryReminder(active(7*day),now)?.daysRemaining===7,
 "Exactly 7 days must show the alert");
assert(instance.expiryReminder(active(6*day),now)?.daysRemaining===6,
 "6 days remaining should show 6 days");
assert(instance.expiryReminder(active(3600000),now)?.daysRemaining===1,
 "One hour remaining must show 1 day, not zero");
assert(instance.expiryReminder(active(0),now)===null,"Expired account must not show a pre-expiry reminder");
assert(instance.expiryReminder(active(4*day,"Free"),now)===null,
 "Free accounts must never receive renewal expiry notices");
assert(instance.expiryReminder({plan:"Starter",subscriptionStatus:"expired",
 planExpiresAt:iso(-3*day)},now)===null,"Expired accounts use separate 10-day retention warning");
assert(instance.expiryReminder({plan:"Starter",subscriptionStatus:"invalid",
 planExpiresAt:"nonsense"},now)===null,"Invalid/missing expiry should fail closed");
instance.updateRenewalNotice();
assert(banner.hidden===false&&copy.textContent.includes("6 วัน")&&
 copy.textContent.includes("ต่ออายุแพ็กเกจเดิมได้ทันที"),
 "In-app banner must show 6-day countdown and same-plan renewal");
instance.setQuota(active(8*day));
instance.updateRenewalNotice();
assert(banner.hidden===true&&copy.textContent==="","Banner must disappear when expiry is >7 days away");
instance.setQuota(active(2*day));
instance.updateRenewalNotice();
assert(banner.hidden===false&&copy.textContent.includes("2 วัน"),
 "Renewal notification should reappear on refreshed account data");
const buyStart=js.indexOf("function planBuyStatus(plan){"),buyEnd=js.indexOf("function renderPlans(){",buyStart);
assert(buyStart>=0&&buyEnd>buyStart,"Plan purchase UI decision missing");
const purchaseCode=js.slice(buyStart,buyEnd);
const plans=[["Free"],["Starter"],["Basic"],["Growth"],["Business"],["Pro"]];
const decision=(quota,plan)=>new Function("plans","q","requested",
 "const remoteQuota=q,promptPayTestEnabled=true,promptPayAccessState='ready';"+
 purchaseCode+"return planBuyStatus(requested);"
)(plans,quota,plan);
const quota={plan:"Starter",subscriptionStatus:"active",
 planExpiresAt:iso(25*day),remaining:120,reserved:0,openBillingRequestId:null};
assert(decision(quota,"Starter").allowed&&decision(quota,"Starter").label.includes("ต่ออายุ"),
 "Customer must allow early same-tier purchase with 120 credits");
assert(!decision({...quota,plan:"Basic"},"Starter").allowed,
 "Downgrade must remain disabled");
assert(decision({...quota,subscriptionStatus:"expired"},"Starter").allowed,
 "Expired account must be able to renew the same tier");
assert(!decision({...quota,reserved:1},"Starter").allowed,
 "Outstanding video reservations block renewal");
assert(!decision({...quota,openBillingRequestId:"ticket_pending"},"Starter").allowed,
 "An open QR request must block another purchase");
console.log("PASS: V6.4.2 exactly seven-day in-app notice, account renewal CTA, early same-tier purchase and downgrade safeguards");
