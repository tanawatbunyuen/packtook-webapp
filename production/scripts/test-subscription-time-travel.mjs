// PACKTOOK V6.4.4 — virtual-clock subscription acceptance tests.
// Reads the real Production Customer and Payment source, without Firebase credentials.
// No network calls, no Firestore reads/writes and no changes to customer accounts.
// Run: node scripts/test-subscription-time-travel.mjs
import fs from "node:fs";
const load=(name)=>fs.readFileSync(new URL("../"+name,import.meta.url),"utf8");
const customer=load("app/app.js");
const html=load("app/index.html");
const style=load("app/style.css");
const payment=load("payment-functions/index.js");
const day=86400000;
const anchor=Date.parse("2026-11-02T03:00:00.000Z"); // 10:00 Asia/Bangkok
const clock={ms:anchor};
class TestDate extends Date{
 constructor(...args){if(args.length)super(...args);else super(clock.ms)}
 static now(){return clock.ms}
}
function expect(condition,message){if(!condition)throw Error("FAIL: "+message)}
function pass(label){console.log("PASS: "+label)}
function virtualTime(delta){clock.ms=anchor+delta}
const expiryAt=(delta)=>new Date(anchor+delta).toISOString();
function section(source,startText,endText){
 const start=source.indexOf(startText);
 const end=source.indexOf(endText,start);
 if(start<0||end<=start)throw Error("Cannot locate actual Production logic: "+startText);
 return source.slice(start,end);
}

// -------- Case #4/#5: customer banner at the actual threshold --------
const customerFunctions=section(customer,
 "// V6.4.2 — 7-day on-screen renewal notice","function updateUsersSummary(){");
expect(html.includes('id="subscriptionExpiryAlert"')&&
 html.includes('id="renewFromAlert"')&&html.includes('id="expiryAlertText"'),
 "Expiry banner and renewal button exist in Customer HTML");
expect(style.includes(".subscription-expiry-alert[hidden]"),
 "Hidden expiry banner must consume no display space");
expect(customer.includes("showTab('plans');$('availablePlans')?.scrollIntoView"),
 "Renewal button must link to Packages");
const banner={hidden:true},message={textContent:""};
const nodes={subscriptionExpiryAlert:banner,expiryAlertText:message};
const plan={plan:"Starter",subscriptionStatus:"active",planExpiresAt:expiryAt(8*day)};
const ui=new Function("Date","$","initialQuota",
 customerFunctions+"\nlet remoteQuota=initialQuota;"+
 "return {expiryReminder,updateRenewalNotice,setQuota(v){remoteQuota=v}};"
)(TestDate,id=>nodes[id],plan);
virtualTime(0);ui.updateRenewalNotice();
expect(banner.hidden===true&&message.textContent==="",
 "Case #5: 8 days before expiry, no warning");
virtualTime(day-1);ui.updateRenewalNotice();
expect(banner.hidden===true,
 "Case #5: 7 days + 1 millisecond before expiry, no warning");
pass("#5: > 7 days: reminder hidden (8d and 7d+1ms)");

virtualTime(day);ui.updateRenewalNotice();
expect(banner.hidden===false&&message.textContent.includes("7 วัน"),
 "Case #4: exactly 7 days must display warning");
virtualTime(2*day);ui.updateRenewalNotice();
expect(banner.hidden===false&&message.textContent.includes("6 วัน"),
 "Case #4: 6 days must display warning");
virtualTime(8*day-1);ui.updateRenewalNotice();
expect(banner.hidden===false&&message.textContent.includes("1 วัน"),
 "Case #4: just before expiration must display one day");
virtualTime(8*day);ui.updateRenewalNotice();
expect(banner.hidden===true,"Expired subscription must hide pre-expiry warning");
virtualTime(0);ui.setQuota({plan:"Free",subscriptionStatus:"free",planExpiresAt:null});
ui.updateRenewalNotice();
expect(banner.hidden===true,"Free must not show a paid plan renewal warning");
virtualTime(day);ui.setQuota({plan:"Starter",subscriptionStatus:"active",planExpiresAt:expiryAt(35*day)});
ui.updateRenewalNotice();
expect(banner.hidden===true,"Renewal extending expiry beyond seven days hides warning");
pass("#4: within 7 days: warning shown, countdown correct, disappears after renewal");

// -------- Case #7: real backend grace policy with controllable Date.now() --------
const backendFunctions=section(payment,"function periodId(","function billingOpen(");
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const tiers=["Free","Starter","Basic","Growth","Business","Pro"];
const actual=new Function("Date","limits","pricesTHB","PLAN_TIERS","CREDIT_GRACE_MS","HttpsError",
 backendFunctions+"\nreturn {subscriptionState,carryoverDeadline,carryoverCredits,retainedCredits,purchasedCreditBalance,purchaseDecision};"
)(TestDate,limits,pricesTHB,tiers,10*day,HttpsError);
const account={
 plan:"Starter",planExpiresAt:expiryAt(0),creditWalletV1:true,
 creditWalletRemaining:120,reserved:0,used:0,period:"2026-11"
};
virtualTime(-1);
expect(actual.subscriptionState(account)==="active","Before expiry: subscription active");
virtualTime(0);
expect(actual.subscriptionState(account)==="expired","At expiry: subscription expired");
expect(actual.retainedCredits(account).eligible&&actual.retainedCredits(account).credits===120,
 "At expiry: retain 120 credits for renewal");
virtualTime(9*day);
expect(actual.carryoverCredits(account)===120,"9 days after expiry: 120 credits carried");
expect(actual.purchasedCreditBalance(account,"Starter").total===170,
 "9 days after expiry: same-plan renewal 120+50=170");
virtualTime(10*day);
expect(actual.carryoverDeadline(account)===clock.ms&&
 actual.retainedCredits(account).eligible&&
 actual.purchasedCreditBalance(account,"Starter").total===170,
 "Exactly 10 days after expiry: still eligible for carryover");
virtualTime(10*day+1);
expect(actual.carryoverCredits(account)===0&&
 !actual.retainedCredits(account).eligible&&
 actual.purchasedCreditBalance(account,"Starter").total===50,
 "10 days + 1 millisecond after expiry: zero carried over");
expect(actual.purchaseDecision(account,"Starter").allowed===true,
 "Expired customer can renew same tier without old credits");
expect(actual.purchaseDecision(account,"Free").allowed===false,
 "Expired customer cannot downgrade");
pass("#7: 10-day wallet grace — 0d, 9d, 10d, and 10d+1ms; renewal amounts 170/50");
console.log("RESULT: ALL 3 pending V6.4.2 boundaries PASS in a virtual clock.");
console.log("SCOPE: deterministic Customer UI logic + Payment Functions policy only.");
console.log("NOTE: scheduled Firestore cleanup is separately tested in test-promptpay.mjs;");
console.log("      this does NOT certify a deployed Production scheduler or real user UI.");
