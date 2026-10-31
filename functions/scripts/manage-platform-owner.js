"use strict";
// Run using trusted Cloud Shell ADC. Never ship Admin SDK credentials to Hosting.
// Usage: node scripts/manage-platform-owner.js grant <firebase-auth-uid>
//        node scripts/manage-platform-owner.js revoke <firebase-auth-uid>
const admin=require("firebase-admin");
const action=process.argv[2],uid=process.argv[3];
if(!["grant","revoke"].includes(action)||!uid||uid.includes("/")||uid.length>128){
 console.error("Usage: node scripts/manage-platform-owner.js grant|revoke <firebase-auth-uid>");
 process.exit(2);
}
if(process.env.GOOGLE_CLOUD_PROJECT!=="packtook-staging"){
 console.error("Refusing to change claims outside packtook-staging. Set GOOGLE_CLOUD_PROJECT explicitly.");
 process.exit(2);
}
admin.initializeApp({projectId:"packtook-staging"});
(async()=>{
 const auth=admin.auth(),user=await auth.getUser(uid);
 if(!user.emailVerified)throw Error("The owner email must be verified before granting this role");
 const claims={...(user.customClaims||{})};
 if(action==="grant")claims.packtookPlatformOwner=true;
 else delete claims.packtookPlatformOwner;
 await auth.setCustomUserClaims(uid,claims);
 console.log("Owner claim",action==="grant"?"granted":"revoked","for UID",uid,"(refresh ID token or sign in again)");
})().catch(e=>{console.error(e.message);process.exitCode=1});
