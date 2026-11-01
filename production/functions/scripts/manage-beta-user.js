"use strict";
// Grant an existing, verified Firebase Auth user the explicit Production Beta claim.
// This script will refuse to run outside packtook-prod-01. No credentials in Git.
const admin=require("firebase-admin");
const project="packtook-prod-01";
const [action,uid]=process.argv.slice(2);
if(!["grant","revoke"].includes(action)||!uid||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)){
 console.error("Usage: GOOGLE_CLOUD_PROJECT=packtook-prod-01 node functions/scripts/manage-beta-user.js grant|revoke FIREBASE_AUTH_UID");
 process.exit(2);
}
if(process.env.GOOGLE_CLOUD_PROJECT!==project){
 console.error("Refusing to modify Auth outside "+project+". Export GOOGLE_CLOUD_PROJECT explicitly.");
 process.exit(2);
}
admin.initializeApp({projectId:project});
(async()=>{
 const auth=admin.auth();
 const user=await auth.getUser(uid);
 if(action==="grant"&&!user.emailVerified)throw Error("Verify the Production user email before granting Beta access");
 const claims={...(user.customClaims||{})};
 if(action==="grant")claims.packtookProductionBeta=true;
 else delete claims.packtookProductionBeta;
 await auth.setCustomUserClaims(uid,claims);
 console.log("Production Beta claim",action==="grant"?"granted":"revoked","for UID",uid);
 console.log("Email:",user.email||"(none)");
 console.log("This action does NOT grant Platform Owner and does NOT access Staging.");
 console.log("Sign out and sign in again to refresh the ID token.");
})().catch(e=>{console.error("FAILED:",e.message);process.exitCode=1});
