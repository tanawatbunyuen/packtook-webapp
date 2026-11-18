"use strict";
/*
 * P65 staging-only authorization candidate. Isolated, dependency-injected,
 * policy copied unchanged for isolated P69 callable candidate.
 * Deployment remains BLOCKED pending approval and wider security review.
 */
const PROJECT="packtook-staging";
const MAX_LEASE_MS=4*60*60*1000;
const MAX_INVITES=3;
const SESSION=/^s65_[A-Za-z0-9_-]{16,64}$/;
const APP_ID=/^1:[0-9]+:web:[A-Za-z0-9]+$/;
const UID=/^[A-Za-z0-9_-]{6,128}$/;
const POLLUTION_KEYS=new Set(["__proto__","constructor","prototype"]);
class StagingAuthorizationError extends Error {
 constructor(code){super(code);this.name="StagingAuthorizationError";this.code=code;}
}
function deny(){throw new StagingAuthorizationError("PERMISSION_DENIED");}
function verifyEnvironment(env){
 if(!env||typeof env!=="object"||env.GCLOUD_PROJECT!==PROJECT||
    (env.GCP_PROJECT&&env.GCP_PROJECT!==PROJECT)||
    env.PACKTOOK_STAGING_PILOT_ENABLED!=="true"||
    env.PACKTOOK_STAGING_PUBLIC_SIGNUP_ENABLED!=="false"||
    env.PACKTOOK_STAGING_PUBLIC_ACCESS_ENABLED!=="false"||
    env.PACKTOOK_PRODUCTION_PROJECT_ID||
    env.PACKTOOK_PUBLIC_SIGNUP_ENABLED==="true"||
    env.PACKTOOK_PUBLIC_ACCESS_ENABLED==="true"||
    env.PACKTOOK_V72_PILOT_ENABLED==="true"||
    !APP_ID.test(env.PACKTOOK_STAGING_PILOT_APP_ID||""))deny();
 return env.PACKTOOK_STAGING_PILOT_APP_ID;
}
function validLease(c,now){
 if(!c||typeof c!=="object"||c.enabled!==true||
    c.ownerApproved!==true||c.legalApproved!==true||
    c.policyVersion!=="p65-staging-review-only"||
    !SESSION.test(c.sessionId||"")||
    typeof c.startedAt!=="string"||typeof c.expiresAt!=="string"||
    !c.startedAt.endsWith("Z")||!c.expiresAt.endsWith("Z"))return false;
 const start=Date.parse(c.startedAt),end=Date.parse(c.expiresAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||
    end<=start||end-start>MAX_LEASE_MS)return false;
 if(!Array.isArray(c.invitedUids)||c.invitedUids.length<1||
    c.invitedUids.length>MAX_INVITES||new Set(c.invitedUids).size!==c.invitedUids.length||
    !c.invitedUids.every(x=>typeof x==="string"&&UID.test(x)&&!POLLUTION_KEYS.has(x)))return false;
 return c.maxInvitedUsers===MAX_INVITES;
}
function createStagingGate({env,readControl,readLiveUser,now=Date.now}){
 if(typeof readControl!=="function"||typeof readLiveUser!=="function"||
    typeof now!=="function")throw new TypeError("P65_DEPENDENCIES_REQUIRED");
 const validated=new WeakSet();
 const expectedAppId=verifyEnvironment(env);
 async function assertAuthorized(req){
  if(!req||typeof req!=="object"||!req.auth||typeof req.auth!=="object"||
     typeof req.auth.uid!=="string"||!UID.test(req.auth.uid))deny();
  if(req.app?.appId!==expectedAppId||
     req.auth.token?.email_verified!==true||
     req.auth.token?.packtookStagingPilot!==true||
     req.auth.token?.packtookProductionBeta===true||
     req.auth.token?.packtookControlledQa===true||
     req.auth.token?.packtookPublicCustomer===true||
     req.auth.token?.packtookPilotV72===true)deny();
  // Revocation checked on every new call; never cache a lease or claims.
  const control=await readControl();
  if(!validLease(control,now())||!control.invitedUids.includes(req.auth.uid)||
     req.auth.token.p65Session!==control.sessionId)deny();
  const user=await readLiveUser(req.auth.uid);
  if(!user||user.uid!==req.auth.uid||user.disabled===true||
     user.emailVerified!==true||typeof user.email!=="string"||!user.email||
     user.customClaims?.packtookStagingPilot!==true||
     user.customClaims?.p65Session!==control.sessionId||
     user.customClaims?.packtookProductionBeta===true||
     user.customClaims?.packtookControlledQa===true||
     user.customClaims?.packtookPublicCustomer===true||
     user.customClaims?.packtookPilotV72===true)deny();
  // Re-check expiry after awaiting cloud reads. Caller may use only this request.
  if(!validLease(control,now()))deny();
  validated.add(req);
  return req.auth.uid;
 }
 function uid(req){
  if(!req||!validated.has(req))deny();
  return req.auth.uid;
 }
 // Callable adapter does not relax any transport policy. The real deployment
 // must prove App Check independently and must not use this module as a
 // replacement for Firebase onCall/auth configuration.
 function wrapReadOnly(handler){
  if(typeof handler!=="function")throw new TypeError("P65_HANDLER_REQUIRED");
  return async req=>{
   await assertAuthorized(req);
   return handler(req,{uid:()=>uid(req)});
  };
 }
 return Object.freeze({assertAuthorized,uid,wrapReadOnly});
}
module.exports={createStagingGate,validLease,verifyEnvironment,StagingAuthorizationError};
