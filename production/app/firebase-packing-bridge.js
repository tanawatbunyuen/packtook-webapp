import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onIdTokenChanged,signInWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-v4-config.js";
const EXPECTED_PROD="packtook-prod-01";
if(firebaseConfig.projectId!==EXPECTED_PROD||!firebaseConfig.appId||!firebaseConfig.apiKey||String(firebaseConfig.projectId).includes("staging"))throw Error("Production Beta: Firebase project configuration mismatch");
const app=initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,"asia-southeast1");
const api=name=>httpsCallable(functions,name);
const deviceKey="packtook-device-v61-production";
const deviceId=()=>{let id=localStorage.getItem(deviceKey);if(!id||!/^[a-zA-Z0-9_-]{16,100}$/.test(id)){id=crypto.randomUUID();localStorage.setItem(deviceKey,id)}return id};
let user=null;
const listeners=new Set();
onIdTokenChanged(auth,async u=>{
 try{
  const token=u?.emailVerified?await u.getIdTokenResult():null;
  user=token?.claims?.packtookProductionBeta===true?u:null;
  if(u?.emailVerified&&!user){await signOut(auth);}
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
 async login(email,password){const result=await signInWithEmailAndPassword(auth,email,password);
 if(!result.user.emailVerified){await sendEmailVerification(result.user);await signOut(auth);throw Error("ระบบส่งลิงก์ยืนยันอีเมลแล้ว โปรดตรวจกล่องจดหมายก่อนเข้าสู่ระบบ")}
 const token=await result.user.getIdTokenResult(true);
 if(token.claims.packtookProductionBeta!==true){await signOut(auth);throw Error("บัญชีนี้ยังไม่ได้รับสิทธิ์ Production Beta กรุณาติดต่อผู้ดูแล")}
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
 async subscriptionOverview(){return (await api("subscriptionOverview")({})).data},
 async billingHistory(afterId=null){return (await api("subscriptionOverview")({historyOnly:true,afterId})).data},
 async omiseConfig(){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async startOmisePayment(requestId,method){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async recoverOmiseCharge(requestId){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async paymentAudit(requestId){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async omisePaymentStatus(requestId){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async cancelUnpaidPlanRequest(requestId){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async requestPlanChange(plan){throw Error("ฟังก์ชันนี้ยังไม่เปิดใช้ใน Production Beta")},
 async accountRole(){return (await api("accountRole")({})).data},
 async authorizeDuplicate(barcode,reason){return (await api("authorizeDuplicate")({barcode,reason})).data},
 async reserve(barcode,operationId,approvalId=null){return (await api("reserveCredit")({barcode,operationId,deviceId:deviceId(),approvalId})).data},
 async finalize(operationId,success,meta={}){return (await api("finalizeCredit")({operationId,success,...meta})).data}
};
window.dispatchEvent(new Event("packtook-firebase-ready"));
