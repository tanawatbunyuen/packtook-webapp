// PACKTOOK V6.4.1 package rules — pure function boundary tests, no Firebase writes.
import fs from "node:fs";
const source=fs.readFileSync(new URL("../payment-functions/index.js",import.meta.url),"utf8");
const start=source.indexOf("function periodId("),end=source.indexOf("function billingOpen(",start);
if(start<0||end<start)throw Error("Package policy source cannot be located");
const definitions=source.slice(start,end);
class HttpsError extends Error{constructor(code,message){super(message);this.code=code}}
const limits={Free:20,Starter:50,Basic:300,Growth:1500,Business:5000,Pro:null};
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const PLAN_TIERS=Object.keys(pricesTHB),CREDIT_GRACE_MS=10*86400000;
const policies=new Function("limits","pricesTHB","PLAN_TIERS","CREDIT_GRACE_MS","HttpsError",
 definitions+";return {purchaseDecision,purchasedCreditBalance,carryoverCredits,carryoverDeadline,retainedCredits};"
)(limits,pricesTHB,PLAN_TIERS,CREDIT_GRACE_MS,HttpsError);
const {purchaseDecision,purchasedCreditBalance,carryoverCredits,carryoverDeadline,retainedCredits}=policies;
const assert=(test,message)=>{if(!test)throw Error("V6.4.1 package policy: "+message)};
const day=86400000,now=Date.now(),iso=timestamp=>new Date(timestamp).toISOString();
const wallet=(plan,expiry,balance,extra={})=>({
 plan,planExpiresAt:expiry,creditWalletV1:true,creditWalletRemaining:balance,
 reserved:0,period:iso(now).slice(0,7),used:0,...extra
});
const active=wallet("Starter",iso(now+15*day),120);
assert(purchaseDecision(active,"Basic",now).allowed===true&&
 purchaseDecision(active,"Basic",now).kind==="upgrade","Active Starter must allow Basic upgrade");
const upgraded=purchasedCreditBalance(active,"Basic",now);
assert(upgraded.purchased===300&&upgraded.transferred===120&&upgraded.total===420,
 "Active upgrade must preserve 120 existing plus 300 new credits");
assert(!purchaseDecision(active,"Free",now).allowed,
 "Downgrade to Free must always be prohibited");
assert(purchaseDecision(active,"Starter",now).allowed&&
 purchaseDecision(active,"Starter",now).kind==="renewal",
 "Paid customers must be able to renew the same plan even with credits and 15 days remaining");
const earlyRenewal=purchasedCreditBalance(active,"Starter",now);
assert(earlyRenewal.purchased===50&&earlyRenewal.transferred===120&&earlyRenewal.total===170,
 "Active Starter 120 + same-tier renewal 50 must yield 170 credits");
const almostExpiry=wallet("Starter",iso(now+7*day),80);
assert(purchaseDecision(almostExpiry,"Starter",now).allowed&&
 purchasedCreditBalance(almostExpiry,"Starter",now).total===130,
 "Exactly seven days before expiry: same-tier renewal should preserve 80 plus 50");
const farFromExpiry=wallet("Basic",iso(now+28*day),200);
assert(purchaseDecision(farFromExpiry,"Basic",now).allowed&&
 purchasedCreditBalance(farFromExpiry,"Basic",now).total===500,
 "Basic self-renewal must work far from expiry with remaining credits");
const expired9=wallet("Starter",iso(now-9*day),120);
assert(purchaseDecision(expired9,"Starter",now).allowed===true,
 "Expired same-tier renewal within 10 days must be allowed");
assert(purchaseDecision(expired9,"Basic",now).allowed===true,
 "Expired Starter to higher-tier Basic must be allowed");
assert(!purchaseDecision(expired9,"Free",now).allowed,
 "Even expired paid accounts cannot downgrade to Free");
assert(purchasedCreditBalance(expired9,"Basic",now).total===420,
 "Expired within grace upgrading must retain full wallet balance");
assert(purchasedCreditBalance(expired9,"Starter",now).total===170,
 "Expired within grace renewing must carry 120+50");
assert(retainedCredits(expired9,now).credits===120&&retainedCredits(expired9,now).eligible,
 "Expired within grace must report retained wallet credit");
const boundary=wallet("Starter",iso(now-10*day),44);
assert(carryoverDeadline(boundary)===now&&carryoverCredits(boundary,now)===44,
 "Exactly ten 24-hour days remain eligible for carryover");
const late=wallet("Starter",iso(now-10*day-1),120);
assert(purchaseDecision(late,"Basic",now).allowed===true,
 "Expired after grace can buy same/higher package");
assert(purchasedCreditBalance(late,"Basic",now).total===300&&
 purchasedCreditBalance(late,"Basic",now).transferred===0,
 "At ten days + 1 ms, old credit must be forfeited");
assert(retainedCredits(late,now).credits===0&&!retainedCredits(late,now).eligible,
 "Expired after grace must report zero transferable credits");
assert(!purchaseDecision(late,"Free",now).allowed,"Late expired paid cannot downgrade");
const proExpired=wallet("Pro",iso(now-30*day),null);
assert(!purchaseDecision(proExpired,"Business",now).allowed,
 "Expired Pro cannot downgrade to Business");
assert(purchaseDecision(proExpired,"Pro",now).allowed,
 "Expired Pro may renew Pro");
const paidWrong=wallet("Unknown",iso(now+day),8);
assert(!purchaseDecision(paidWrong,"Basic",now).allowed,"Unknown paid plan must fail closed");
const legacyPaid={plan:"Starter",planExpiresAt:iso(now-3*day),used:8,reserved:0,
 period:"2020-01",creditWalletV1:false};
assert(purchasedCreditBalance(legacyPaid,"Basic",now).total===342,
 "Legacy paid plan may not gain fresh monthly credits when grace spans months");
const free={plan:"Free",period:iso(now).slice(0,7),used:5,reserved:0,creditWalletV1:false};
assert(purchasedCreditBalance(free,"Starter",now).total===65,
 "Free 15 remaining + Starter 50 = 65 credits");
const reserved=wallet("Starter",iso(now+day),30,{reserved:1});
assert(!purchaseDecision(reserved,"Basic",now).allowed,
 "An in-flight video reservation must block package purchase");
console.log("PASS: V6.4.2 same-tier renewal anytime, 7-day boundary, no downgrade, 10-day carryover, 120+300 upgrade");
