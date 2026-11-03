// PACKTOOK V7.2 — pre-created Auth users only, never public registration.
// App Check is attached to protected Pilot callables, and server-side
// Firestore UID allowlist/lease/claims remain authoritative at EVERY step.
import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendEmailVerification,reload} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-v4-config.js";
import {signupConfig} from "./signup-config.js";

const PROJECT="packtook-prod-01";
if(firebaseConfig.projectId!==PROJECT||
   firebaseConfig.authDomain!==PROJECT+".firebaseapp.com"||
   !/^1:[0-9]+:web:[A-Za-z0-9]+$/.test(firebaseConfig.appId||"")||
   !firebaseConfig.apiKey||String(firebaseConfig.projectId).includes("staging"))
 throw Error("PILOT SAFETY BLOCK: Production Customer Firebase configuration missing");
if(typeof signupConfig.appCheckSiteKey!=="string"||
   signupConfig.appCheckSiteKey.trim().length<30||
   signupConfig.policyVersion!=="2026-11-v1")
 throw Error("PILOT SAFETY BLOCK: App Check / policy configuration missing");
const app=initializeApp(firebaseConfig);
initializeAppCheck(app,{
 provider:new ReCaptchaEnterpriseProvider(signupConfig.appCheckSiteKey.trim()),
 isTokenAutoRefreshEnabled:true
});
const auth=getAuth(app),functions=getFunctions(app,"asia-southeast1");
const call=name=>httpsCallable(functions,name);
const el=id=>document.getElementById(id);
let currentUser=null,eligibility=null,busy=false,checking=0,verificationMailSent=false;

function report(message){el("status").textContent=message}
function labelError(error){
 switch(error?.code){
  case "functions/permission-denied":
  case "functions/unauthenticated":
   return "คำเชิญไม่ถูกต้อง ถูกยกเลิก หรือหมดอายุ โปรดติดต่อผู้ดูแล";
  case "functions/failed-precondition":
   return "Pilot ยังไม่พร้อมเปิดใช้งานหรือการตั้งค่าความปลอดภัยไม่ครบ";
  case "functions/resource-exhausted":
   return "ถึงเพดานการทดสอบหรือการส่งอีเมลแล้ว โปรดติดต่อผู้ดูแล";
  case "auth/too-many-requests":
   return "มีการเรียกใช้งานมากเกินไป โปรดลองใหม่ภายหลัง";
  case "auth/invalid-credential":
  case "auth/wrong-password":
  case "auth/user-not-found":
   return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  default:return "ยังไม่สามารถดำเนินการได้ โปรดติดต่อผู้ดูแล";
 }
}
function currentLeaseActive(value){
 return value?.enabled===true&&value?.testOnly===true&&
  value?.policyVersion===signupConfig.policyVersion&&
  Number.isFinite(Date.parse(value?.expiresAt))&&
  Date.parse(value.expiresAt)>Date.now();
}
function resetUI(){
 const signed=!!currentUser,valid=!!eligibility&&currentLeaseActive(eligibility);
 const verified=valid&&eligibility.verified===true;
 const active=verified&&eligibility.active===true;
 el("loginForm").hidden=signed;
 el("memberPanel").hidden=!signed;
 el("inviteState").textContent=!valid?"ยังไม่ยืนยันสิทธิ์":active?"เปิดใช้งานแล้ว":verified?"พร้อมเปิดใช้":"รอยืนยันอีเมล";
 el("identity").textContent=!signed?"":!valid?
  "กำลังตรวจคำเชิญจาก Backend":active?
  "บัญชี Pilot เปิดใช้งานแล้ว สามารถเข้าสู่ PACKING ได้":
  verified?"อีเมลยืนยันแล้ว โปรดอ่านและยอมรับเงื่อนไข":"อีเมลยังไม่ยืนยัน โปรดตรวจกล่องข้อความ";
 el("expiry").textContent=valid?
  "สิทธิ์สิ้นสุด "+new Date(eligibility.expiresAt).toLocaleString("th-TH"):"";
 el("consentBox").disabled=busy||!verified||active;
 el("activate").hidden=active;
 el("activate").disabled=busy||!verified||active||
  !el("acceptTerms").checked||!el("acceptPrivacy").checked;
 el("enterPacking").hidden=!active;
 el("enterPacking").disabled=busy||!active;
 el("sendVerify").disabled=busy||!valid||verified||verificationMailSent;
 el("refresh").disabled=busy||!signed;
 el("logout").disabled=busy||!signed;
 el("signIn").disabled=busy;
}
async function checkStatus(){
 const user=currentUser,serial=++checking;
 eligibility=null;
 resetUI();
 if(!user){report("เฉพาะบัญชีที่ได้รับเชิญล่วงหน้าเท่านั้น Public Signup ยังปิดอยู่");return}
 try{
  // This callable refuses every uninvited UID BEFORE returning anything.
  const result=(await call("pilotInvitationStatus")({})).data;
  if(serial!==checking||auth.currentUser?.uid!==user.uid)return;
  if(!currentLeaseActive(result))throw Error("Pilot lease unavailable");
  eligibility=result;
  resetUI();
  report(result.active===true?"สิทธิ์ Pilot ยังเปิดอยู่ สามารถเข้า PACKING ได้":
   result.verified===true?
   "ตรวจสอบคำเชิญแล้ว ยอมรับเงื่อนไขเพื่อเปิดใช้ Free 20 วิดีโอ":
   "คำเชิญยังใช้ได้ กรุณายืนยันอีเมลก่อนเปิดใช้งาน");
 }catch(error){
  if(serial!==checking||auth.currentUser?.uid!==user.uid)return;
  eligibility=null;resetUI();
  report(labelError(error));
 }
}
onAuthStateChanged(auth,async user=>{
 const previousUid=currentUser?.uid;
 currentUser=user;
 if(previousUid!==user?.uid){
  verificationMailSent=false;
  el("acceptTerms").checked=false;el("acceptPrivacy").checked=false;
 }
 if(!user){checking++;eligibility=null;resetUI();report("ออกจากระบบแล้ว — Public Signup ยังปิดอยู่");return}
 try{await checkStatus()}catch{eligibility=null;resetUI();report("ไม่สามารถตรวจคำเชิญได้")}
});
el("acceptTerms").addEventListener("change",resetUI);
el("acceptPrivacy").addEventListener("change",resetUI);
el("loginForm").addEventListener("submit",async event=>{
 event.preventDefault();if(busy)return;
 busy=true;resetUI();
 try{
  const email=el("email").value.trim(),password=el("password").value;
  if(!email||!password)throw Error("Missing credentials");
  report("กำลังตรวจคำเชิญจาก Backend");
  await signInWithEmailAndPassword(auth,email,password);
 }catch(error){report(labelError(error))}
 finally{el("password").value="";busy=false;resetUI()}
});
el("sendVerify").addEventListener("click",async()=>{
 if(busy||!currentUser||!currentLeaseActive(eligibility)||
    eligibility.verified===true||verificationMailSent)return;
 busy=true;resetUI();
 try{
  // A fresh invite check gates the email request; no generic Auth signup.
  const fresh=(await call("pilotInvitationStatus")({})).data;
  if(!currentLeaseActive(fresh)||fresh.verified===true)throw Error("Not eligible for verify email");
  await sendEmailVerification(currentUser);
  verificationMailSent=true;
  report("ส่งอีเมลยืนยันแล้ว โปรดตรวจ Inbox/Spam แล้วกลับมากดตรวจสอบอีกครั้ง");
 }catch(error){report(labelError(error))}
 finally{busy=false;resetUI()}
});
el("refresh").addEventListener("click",async()=>{
 if(busy||!currentUser)return;
 busy=true;resetUI();
 try{
  await reload(currentUser);
  await currentUser.getIdToken(true);
  await checkStatus();
 }catch(error){report(labelError(error))}
 finally{busy=false;resetUI()}
});
el("activate").addEventListener("click",async()=>{
 if(busy||!currentUser||!currentLeaseActive(eligibility)||
    eligibility.verified!==true||eligibility.active===true||
    !el("acceptTerms").checked||!el("acceptPrivacy").checked)return;
 busy=true;resetUI();
 try{
  await reload(currentUser);
  if(!currentUser.emailVerified)throw Error("Email verification required");
  const result=(await call("completePilotFreeSignup")({
   acceptTestTerms:true,acceptPrivacy:true,policyVersion:signupConfig.policyVersion
  })).data;
  if(result?.activated!==true)throw Error("Pilot activation unconfirmed");
  const token=await currentUser.getIdTokenResult(true);
  if(token.claims.packtookPilotV72!==true)throw Error("Pilot Auth claim not ready");
  const current=(await call("pilotInvitationStatus")({})).data;
  if(!currentLeaseActive(current)||current.active!==true)
   throw Error("Pilot lease not active");
  eligibility=current;
  resetUI();
  report("เปิดสิทธิ์ Free Pilot แล้ว กำลังเข้าสู่ PACKING");
  location.assign("./index.html");
 }catch(error){
  report(labelError(error));
  await checkStatus();
 }finally{busy=false;resetUI()}
});
el("enterPacking").addEventListener("click",async()=>{
 if(busy||!currentUser||eligibility?.active!==true)return;
 busy=true;resetUI();
 try{
  const token=await currentUser.getIdTokenResult(true);
  const fresh=(await call("pilotInvitationStatus")({})).data;
  if(token.claims.packtookPilotV72!==true||
     !currentLeaseActive(fresh)||fresh.active!==true)
   throw Error("Pilot lease expired");
  location.assign("./index.html");
 }catch(error){report(labelError(error));await checkStatus()}
 finally{busy=false;resetUI()}
});
el("logout").addEventListener("click",async()=>{
 if(busy)return;
 busy=true;resetUI();
 try{await signOut(auth);eligibility=null;report("ออกจากระบบแล้ว")}
 catch(error){report(labelError(error))}
 finally{el("password").value="";busy=false;resetUI()}
});
resetUI();
