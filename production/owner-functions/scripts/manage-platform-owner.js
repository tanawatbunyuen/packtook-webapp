"use strict";
// Grants/revokes the platform-wide Owner claim only in PACKTOOK Production.
// Run in trusted Cloud Shell with Application Default Credentials, never from a browser.
const admin=require("firebase-admin");
const PROJECT="packtook-prod-01";
const [action,uid]=process.argv.slice(2);
if(!["grant","revoke"].includes(action)||!uid||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)){
 console.error("Usage: GOOGLE_CLOUD_PROJECT=packtook-prod-01 node owner-functions/scripts/manage-platform-owner.js grant|revoke PRODUCTION_OWNER_UID");
 process.exit(2);
}
if(process.env.GOOGLE_CLOUD_PROJECT!==PROJECT){
 console.error("ERROR: Refusing Owner claim management outside "+PROJECT);
 process.exit(2);
}
admin.initializeApp({projectId:PROJECT});
(async()=>{
 const auth=admin.auth(),user=await auth.getUser(uid);
 if(action==="grant"&&!user.emailVerified)throw Error("Verify the Production Owner email before granting permission");
 const claims={...(user.customClaims||{})};
 if(action==="grant")claims.packtookPlatformOwner=true;
 else delete claims.packtookPlatformOwner;
 await auth.setCustomUserClaims(uid,claims);
 await auth.revokeRefreshTokens(uid); // Access revocation takes effect on token refresh; already-issued tokens can remain valid until expiry.
 console.log("PACKTOOK Production Platform Owner claim:",action==="grant"?"GRANTED":"REVOKED","for UID:",uid);
 console.log("Owner Email:",user.email||"(none)");
 console.log("Sign out and sign in again after claim changes.");
})().catch(e=>{console.error("FAILED:",e.message);process.exitCode=1});
