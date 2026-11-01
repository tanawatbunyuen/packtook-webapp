"use strict";
// Grant/revoke additional PACKTOOK Production Owner Customer Manager privileges.
// This is not callable from the website; execute with trusted Cloud Shell credentials.
const admin=require("firebase-admin");
const PROJECT="packtook-prod-01";
const [action,uid]=process.argv.slice(2);
if(!["grant","revoke"].includes(action)||!uid||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)){
 console.error("Usage: GOOGLE_CLOUD_PROJECT=packtook-prod-01 node owner-functions/scripts/manage-owner-manager.js grant|revoke OWNER_UID");
 process.exit(2);
}
if(process.env.GOOGLE_CLOUD_PROJECT!==PROJECT){
 console.error("ERROR: Wrong project. Owner Manager can be changed only in "+PROJECT);
 process.exit(2);
}
admin.initializeApp({projectId:PROJECT});
(async()=>{
 const auth=admin.auth(),user=await auth.getUser(uid);
 if(action==="grant"&&(user.disabled||!user.emailVerified||user.customClaims?.packtookPlatformOwner!==true))
  throw Error("Verified active Production Platform Owner account required");
 const next={...(user.customClaims||{})};
 if(action==="grant")next.packtookOwnerManager=true;
 else delete next.packtookOwnerManager;
 await auth.setCustomUserClaims(uid,next);
 await auth.revokeRefreshTokens(uid);
 console.log("Production Owner Manager:",action==="grant"?"GRANTED":"REVOKED","UID:",uid);
 console.log("Sign out/in to refresh browser ID token. Production Owner Management must also be explicitly enabled in backend environment.");
})().catch(e=>{console.error("FAILED:",e.message);process.exitCode=1});
