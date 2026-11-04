// PACKTOOK V7.2 — source-only pilot security assertions, no cloud actions.
// Source text contracts are regression checks; real SDK and App Check still
// require DEMO / controlled browser evidence before deployment approval.
import fs from "node:fs";
export const PILOT_PROTECTED_CALLABLES=Object.freeze([
 "usageStatus","reserveCredit","finalizeCredit","pendingVideoReservations",
 "recoverStaleVideoReservation","recordingStatus","registerDevice",
 "deviceStatus","removeDevice","authorizeDuplicate","accountRole",
 "subscriptionOverview"
]);
export function inspectPilotSource(backend){
 const has=v=>backend.includes(v);
 const checks={
  explicitDefaultOff:has('const V72_PILOT_ENABLED=process.env.PACKTOOK_V72_PILOT_ENABLED==="true"'),
  explicitPublicQaOff:has("!PUBLIC_SIGNUP_ENABLED&&!PUBLIC_ACCESS_ENABLED&&!PUBLIC_POLICIES_APPROVED&&")&&
   has("!V7_QA_ENABLED&&publicCustomerAppReady()"),
  exactSignedAppCheck:has("req.app?.appId!==PUBLIC_CUSTOMER_APP_ID")&&
   has('exports.pilotInvitationStatus=onCall({...options,enforceAppCheck:true')&&
   has('exports.completePilotFreeSignup=onCall({...options,enforceAppCheck:true'),
  secretBoundToPilot:has('secrets:[PUBLIC_FREE_EMAIL_HMAC_SECRET],serviceAccount:PUBLIC_PILOT_RUNTIME_SA},async req=>{'),
  activeServerSideUidAllowlist:has('c.invitedUids.includes(req.auth.uid)')&&
   has('control.invitedUids.includes(id)')&&
   has('c.invitedUids')&&has("invites.length>V72_PILOT_MAX_USERS"),
  leaseFourHours:has("V72_PILOT_MAX_MS=4*60*60*1000")&&
   has("end-start>V72_PILOT_MAX_MS")&&
   has("end<=now")&&has("c.enabled!==true"),
  firestoreRuntimeKillSwitch:has('db.collection("pilotControls").doc("v72")')&&
   has("PILOT_V72_CONTROL.get()")&&
   has("tx.get(PILOT_V72_CONTROL)")&&
   has('const current=await requirePilotLease(req);'),
  actorAndSignedClaims:has("live.customClaims?.packtookProductionBeta===true")&&
   has("live.customClaims?.packtookControlledQa===true")&&
   has("live.customClaims?.packtookPublicCustomer===true")&&
   has("packtookPilotV72Session:lease.sessionId"),
  onEveryProtectedRequest:has("await requirePilotLease(req,{claimRequired:true});")&&
   has("PILOT_VALIDATED_REQUESTS.add(req)")&&
   has("PILOT_VALIDATED_REQUESTS.has(req)")&&
   has("const PILOT_VALIDATED_REQUESTS=new WeakSet()")&&
   PILOT_PROTECTED_CALLABLES.every(n=>has("exports."+n+"=guardedCall(options,async req=>{"))&&
   !PILOT_PROTECTED_CALLABLES.some(n=>has("exports."+n+"=onCall(options,async req=>{")),
  safeGrantTransaction:has('registrationSource:"controlled_pilot_v72"')&&
   has('guard.doc("email_v1_"+publicEmailKey(live.email))')&&
   has("tx.create(emailIndex")&&has("tx.create(ref,{ownerUid:id")&&
   has("if(emailSnap.exists)")&&has("if(!publicAbuseReady())"),
  noClientFirestoreAccess:has('const PILOT_V72_CONTROL=db.collection("pilotControls").doc("v72")')&&
   !has("exports.setPilotControl")&&!has("exports.invitePilotUser"),
  noEmbeddedPilotIdentifiers:!/\b(?:PILOT_UID|PILOT_EMAIL|PILOT_PASSWORD|PILOT_AUTH_TOKEN)\s*=/.test(backend)
 };
 return {sourcePass:Object.values(checks).every(Boolean),checks,
  assessedProtectedCallableCount:PILOT_PROTECTED_CALLABLES.length};
}
const isMain=process.argv[1]&&process.argv[1].endsWith("/v72-pilot-source-check.mjs");
if(isMain){
 const source=fs.readFileSync(new URL("../functions/index.js",import.meta.url),"utf8");
 const report=inspectPilotSource(source);
 console.log(JSON.stringify(report,null,2));
 if(!report.sourcePass)process.exitCode=2;
}
