import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onIdTokenChanged,signInWithEmailAndPassword,createUserWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut,reload} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-v4-config.js";
import {signupConfig} from "./signup-config.js";
const EXPECTED_PROD="packtook-prod-01";
if(firebaseConfig.projectId!==EXPECTED_PROD||!firebaseConfig.appId||!firebaseConfig.apiKey||String(firebaseConfig.projectId).includes("staging"))throw Error("Production Beta: Firebase project configuration mismatch");
const app=initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,"asia-southeast1");
// App Check must be configured before any public Free activation is enabled.
// Blank site key is a deliberate fail-closed pre-launch default.
const appCheckReady=typeof signupConfig.appCheckSiteKey==="string"&&signupConfig.appCheckSiteKey.trim().length>15;
if(appCheckReady)initializeAppCheck(app,{
 provider:new ReCaptchaEnterpriseProvider(signupConfig.appCheckSiteKey.trim()),
 isTokenAutoRefreshEnabled:true
});
const api=name=>httpsCallable(functions,name);
const deviceKey="packtook-device-v61-production";
const deviceId=()=>{let id=localStorage.getItem(deviceKey);if(!id||!/^[a-zA-Z0-9_-]{16,100}$/.test(id)){id=crypto.randomUUID();localStorage.setItem(deviceKey,id)}return id};
let user=null;
const listeners=new Set();
async function signupAvailability(){
 try{
  const result=(await api("publicSignupStatus")({})).data;
  return {...result,enabled:result.enabled===true&&appCheckReady&&
   result.policyVersion===signupConfig.policyVersion,
   appCheckConfigured:appCheckReady};
 }catch(e){return {enabled:false,accessEnabled:false,
  policyVersion:signupConfig.policyVersion,appCheckConfigured:appCheckReady};}
}
// V7.0: guarded QA status is callable only by the signed-in, invited UID
// with valid App Check and a short-lived server window. No public discovery.
async function qaAvailability(){
 try{
  const value=(await api("qaFreeStatus")({})).data;
  return value?.enabled===true&&value.verified===true;
 }catch{return false}
}
// V7.2: a Pilot claim alone never authorizes PACKING. Ask the protected
// backend for the CURRENT invite lease/session on every new login/session.
// This remains separate from Public availability and V7.0 QA.
async function pilotAvailability(){
 try{
  if(!appCheckReady)return {active:false};
  const value=(await api("pilotInvitationStatus")({})).data;
  return {active:value?.enabled===true&&value?.verified===true&&
   value?.active===true&&value?.policyVersion===signupConfig.policyVersion};
 }catch{return {active:false}}
}
function isEligible(token){
 return token?.claims?.packtookProductionBeta===true||
  token?.claims?.packtookPublicCustomer===true||
  token?.claims?.packtookControlledQa===true||
  token?.claims?.packtookPilotV72===true;
}
onIdTokenChanged(auth,async u=>{
 try{
  const token=u?.emailVerified?await u.getIdTokenResult():null;
  // Beta sessions remain available. Public sessions require the independent
  // server-side access flag even if an older token still has a public claim.
  if(token?.claims?.packtookProductionBeta===true)user=u;
  else if(token?.claims?.packtookControlledQa===true)
   user=await qaAvailability()?u:null;
  else if(token?.claims?.packtookPilotV72===true)
   user=(await pilotAvailability()).active===true?u:null;
  else if(token?.claims?.packtookPublicCustomer===true){
   const status=await signupAvailability();user=status.accessEnabled===true?u:null;
  }else user=null;
  // Verified, unprovisioned users can finish Free onboarding on the login
  // screen; they have no app access or credit until the server grants a claim.
 }catch(e){user=null;console.warn("Production Beta authorization not ready",e?.code||"error");}
 for(const cb of listeners)cb(user);
});
window.PACKTOOK_FIREBASE={
 ready:true,
 get deviceId(){return deviceId()},
 async registerDevice(name){return (await api("registerDevice")({deviceId:deviceId(),name})).data},
 async removeDevice(targetId){return (await api("removeDevice")({deviceId:deviceId(),targetId})).data},
 async deviceStatus(){return (await api("deviceStatus")({deviceId:deviceId()})).data},
 onUser(cb){listeners.add(cb);cb(user);return()=>listeners.delete(cb)},
 async signupAvailability(){return signupAvailability()},
 async registerPublic(email,password){
  const status=await signupAvailability();
  if(!status.enabled)throw Error("ระบบสมัครสมาชิกยังไม่เปิดให้บริการ");
  if(typeof email!=="string"||!email.includes("@")||typeof password!=="string"||password.length<8)
   throw Error("กรุณาใช้อีเมลที่ถูกต้องและรหัสผ่านอย่างน้อย 8 ตัวอักษร");
  const registered=await createUserWithEmailAndPassword(auth,email.trim(),password);
  try{await sendEmailVerification(registered.user)}
  finally{await signOut(auth)}
  return {email:registered.user.email,verificationSent:true};
 },
 async completePublicSignup(){
  const status=await signupAvailability();
  if(!status.enabled)throw Error("ระบบเปิดใช้งาน Free ยังไม่พร้อม");
  const current=auth.currentUser;
  if(!current)throw Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  await reload(current);
  if(!current.emailVerified)throw Error("กรุณายืนยันอีเมลก่อนเริ่มใช้งาน");
  const result=(await api("completeFreeSignup")({
   acceptTerms:true,termsVersion:status.policyVersion,privacyVersion:status.policyVersion
  })).data;
  const token=await current.getIdTokenResult(true);
  if(token.claims.packtookPublicCustomer!==true)throw Error("ยังไม่ได้รับสิทธิ์ Free กรุณาลองอีกครั้ง");
  const previous=user;user=current;
  if(previous!==current)for(const cb of listeners)cb(user);
  return {user:current,activated:result.activated,created:result.created};
 },
 async login(email,password){const result=await signInWithEmailAndPassword(auth,email,password);
 if(!result.user.emailVerified){await sendEmailVerification(result.user);await signOut(auth);throw Error("ระบบส่งลิงก์ยืนยันอีเมลแล้ว โปรดตรวจกล่องจดหมายก่อนเข้าสู่ระบบ")}
 const token=await result.user.getIdTokenResult(true);
 if(token.claims.packtookControlledQa===true&&token.claims.packtookProductionBeta!==true){
  if(!await qaAvailability()){await signOut(auth);throw Error("สิทธิ์ทดสอบ V7.0 หมดอายุหรือถูกปิด โปรดติดต่อผู้ดูแล")}
 }
 if(token.claims.packtookPilotV72===true&&token.claims.packtookProductionBeta!==true){
  if(!(await pilotAvailability()).active){await signOut(auth);throw Error("สิทธิ์ทดสอบ Pilot หมดอายุหรือถูกปิด โปรดติดต่อผู้ดูแล")}
 }
 if(token.claims.packtookPublicCustomer===true&&token.claims.packtookProductionBeta!==true){
  const access=await signupAvailability();
  if(access.accessEnabled!==true){await signOut(auth);throw Error("การเข้าสู่ระบบ Free ยังไม่เปิดให้บริการ")}
 }
 if(!isEligible(token)){
  const status=await signupAvailability();
  if(status.enabled){
   const err=new Error("ยืนยันอีเมลสำเร็จแล้ว กรุณายอมรับเงื่อนไขเพื่อเปิดใช้งาน Free");
   err.code="packtook/finish-signup";throw err;
  }
  await signOut(auth);
  throw Error("บัญชีนี้ยังไม่ได้รับสิทธิ์ Production Beta กรุณาติดต่อผู้ดูแล");
 }
 return result.user;},
 async logout(){await signOut(auth)},
 async resetPassword(email){if(typeof email!=="string"||!email.trim())throw Error("กรุณากรอกอีเมลก่อน");await sendPasswordResetEmail(auth,email.trim());return true;},
 async usage(){return (await api("usageStatus")({})).data},
 async recordingStatus(operationId){return (await api("recordingStatus")({operationId})).data},
 async pendingVideoReservations(){return (await api("pendingVideoReservations")({})).data},
 async recoverStaleVideoReservation(operationId){return (await api("recoverStaleVideoReservation")({operationId,confirmNoVideo:true})).data},
 async inviteOperator(email){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async acceptOperatorInvite(){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async listOperators(){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async requestDuplicate(barcode,reason){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async myDuplicateRequests(){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async listDuplicateRequests(){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async approveDuplicateRequest(requestId){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async operatorApprovalStatus(requestId){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async subscriptionOverview(){return (await api("promptpaySubscriptionOverview")({})).data},
 async billingHistory(afterId=null){return (await api("promptpayBillingHistory")({afterId})).data},
 async omiseConfig(){return (await api("promptpayConfig")({})).data},
 async startOmisePayment(requestId,method){if(method!=="promptpay")throw Error("รองรับเฉพาะ PromptPay QR");return (await api("promptpayCreateCharge")({requestId,method:"promptpay"})).data},
 async recoverOmiseCharge(requestId){return (await api("promptpayRecoverCharge")({requestId})).data},
 async paymentAudit(requestId){return (await api("promptpayAudit")({requestId})).data},
 async omisePaymentStatus(requestId){return (await api("promptpayChargeStatus")({requestId})).data},
 async cancelUnpaidPlanRequest(requestId){return (await api("promptpayCancelRequest")({requestId})).data},
 async requestPlanChange(plan){return (await api("promptpayRequestPlanChange")({plan})).data},
 async accountRole(){return (await api("accountRole")({})).data},
 async authorizeDuplicate(barcode,reason){return (await api("authorizeDuplicate")({barcode,reason})).data},
 async reserve(barcode,operationId,approvalId=null){return (await api("reserveCredit")({barcode,operationId,deviceId:deviceId(),approvalId})).data},
 async finalize(operationId,success,meta={}){return (await api("finalizeCredit")({operationId,success,...meta})).data}
};
window.dispatchEvent(new Event("packtook-firebase-ready"));
