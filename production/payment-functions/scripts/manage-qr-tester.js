"use strict";
// Explicit Production-only QR Test allowlist. Never grants real payment rights.
const admin=require("firebase-admin"),PROJECT="packtook-prod-01";
const [action,uid]=process.argv.slice(2);
if(process.env.GOOGLE_CLOUD_PROJECT!==PROJECT||!["grant","revoke"].includes(action)||
 !uid||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)){
 console.error("Usage: GOOGLE_CLOUD_PROJECT=packtook-prod-01 node payment-functions/scripts/manage-qr-tester.js grant|revoke VERIFIED_BETA_UID");
 process.exit(2);
}
admin.initializeApp({projectId:PROJECT});
(async()=>{
 const auth=admin.auth(),user=await auth.getUser(uid);
 if(action==="grant"&&(user.disabled||!user.emailVerified||user.customClaims?.packtookProductionBeta!==true||
   user.customClaims?.packtookPlatformOwner===true))
  throw Error("Only active verified Production Beta Customer accounts can be QR testers. Owner accounts are not eligible.");
 const claims={...(user.customClaims||{})};
 if(action==="grant")claims.packtookPaymentTester=true;
 else delete claims.packtookPaymentTester;
 await auth.setCustomUserClaims(uid,claims);
 await auth.revokeRefreshTokens(uid);
 console.log("Production PromptPay QR Tester:",action==="grant"?"GRANTED":"REVOKED","for UID:",uid);
 console.log("Email:",user.email||"(none)");
 console.log("Sign out and sign back in to refresh Firebase custom claims.");
})().catch(e=>{console.error("FAILED:",e.message);process.exitCode=1});
