// PACKTOOK V7.0 — invitation-only QA page; no public account creation.
// Uses production Firebase Auth and App Check but requires the server's
// exact invited UID, App ID, active 48h-or-shorter window, and verified email.
import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut,sendEmailVerification,reload} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {initializeAppCheck,ReCaptchaEnterpriseProvider} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-v4-config.js";
import {signupConfig} from "./signup-config.js";
const PROJECT="packtook-prod-01";
if(firebaseConfig.projectId!==PROJECT||firebaseConfig.authDomain!==PROJECT+".firebaseapp.com"||!firebaseConfig.appId)
 throw Error("QA SAFETY BLOCK: Customer Firebase app must match the exact Production project");
if(typeof signupConfig.appCheckSiteKey!=="string"||signupConfig.appCheckSiteKey.trim().length<30)
 throw Error("QA SAFETY BLOCK: real reCAPTCHA Enterprise App Check key is required");
const app=initializeApp(firebaseConfig);
initializeAppCheck(app,{
 provider:new ReCaptchaEnterpriseProvider(signupConfig.appCheckSiteKey.trim()),
 isTokenAutoRefreshEnabled:true
});
const auth=getAuth(app),functions=getFunctions(app,"asia-southeast1");
const call=name=>httpsCallable(functions,name);
const el=id=>document.getElementById(id);
let eligibility=null,currentUser=null,busy=false;
function report(message){
 el("status").textContent=message;
}
function resetUI(){
 el("loginForm").hidden=!!currentUser;
 el("memberPanel").hidden=!currentUser;
 el("activate").disabled=busy||!currentUser||eligibility?.enabled!==true||
  eligibility.verified!==true||!el("accept").checked;
 el("sendVerify").disabled=busy||!currentUser||eligibility?.verified===true;
 el("refresh").disabled=busy||!currentUser;
 el("logout").disabled=busy;
}
async function checkStatus(){
 eligibility=null;
 if(!currentUser){resetUI();report("สำหรับบัญชี QA ที่ได้รับเชิญเท่านั้น");return}
 try{
  const result=(await call("qaFreeStatus")({})).data;
  eligibility=result;
  el("identity").textContent=result.verified
   ?"อีเมลยืนยันแล้ว — เปิดบัญชี Free QA ได้เมื่อยอมรับเงื่อนไขทดสอบ"
   :"อีเมลยังไม่ยืนยัน — ส่งอีเมลและคลิกลิงก์ก่อน";
  report("สิทธิ์ QA ใช้ได้ถึง "+new Date(result.expiresAt).toLocaleString("th-TH")+
   ". การสมัคร Public ยังปิดอยู่");
 }catch(e){
  el("identity").textContent="บัญชีนี้ไม่มีสิทธิ์ QA หรือหมดอายุ";
  report("ไม่สามารถเปิด QA: "+(e?.code||"permission-denied")+
   " — โปรดให้ผู้ดูแลตรวจ UID และ App Check ใน Firebase Console");
 }
 resetUI();
}
onAuthStateChanged(auth,async user=>{
 currentUser=user;
 try{await checkStatus()}catch(e){report(e?.message||"QA status error");resetUI()}
});
el("accept").addEventListener("change",resetUI);
el("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();if(busy)return;busy=true;resetUI();
 try{
  const email=el("email").value.trim(),password=el("password").value;
  if(!email||!password)throw Error("กรุณากรอกข้อมูลเข้าสู่ระบบ");
  await signInWithEmailAndPassword(auth,email,password);
  // Clear password from DOM as soon as Auth answers.
  el("password").value="";
  report("เข้าสู่ระบบสำเร็จ กำลังตรวจสิทธิ์ QA");
 }catch(err){el("password").value="";report("เข้าสู่ระบบไม่ได้: "+(err?.code||"error"))}
 finally{busy=false;resetUI()}
});
el("sendVerify").addEventListener("click",async()=>{
 if(busy||!currentUser)return;busy=true;resetUI();
 try{
  if(!eligibility?.enabled)throw Error("ไม่มีสิทธิ์ส่งอีเมลใน QA");
  if(currentUser.emailVerified){report("อีเมลได้รับการยืนยันแล้ว");return}
  await sendEmailVerification(currentUser);
  report("ส่งอีเมลยืนยันแล้ว ตรวจ Inbox/Spam และคลิกลิงก์ก่อนกลับมากดตรวจสอบอีกครั้ง");
 }catch(e){report("ส่งลิงก์ยืนยันไม่สำเร็จ: "+(e?.code||e.message))}
 finally{busy=false;resetUI()}
});
el("refresh").addEventListener("click",async()=>{
 if(busy||!currentUser)return;busy=true;
 try{
  await reload(currentUser);
  await currentUser.getIdToken(true);
  await checkStatus();
 }catch(e){report("ตรวจสอบอีเมลไม่สำเร็จ: "+(e?.code||"error"))}
 finally{busy=false;resetUI()}
});
el("activate").addEventListener("click",async()=>{
 if(busy||!eligibility?.enabled||!eligibility.verified||!el("accept").checked)return;
 busy=true;resetUI();
 try{
  const result=(await call("completeQaFreeSignup")({
   acceptTestTerms:true,policyVersion:signupConfig.policyVersion
  })).data;
  if(result?.activated!==true)throw Error("QA activation was not confirmed");
  const token=await currentUser.getIdTokenResult(true);
  if(token.claims.packtookControlledQa!==true)throw Error("QA Auth claim not ready");
  report("เปิด Free QA สำเร็จ (20 วิดีโอ/เดือน) กำลังไปหน้า PACKING");
  location.assign("./index.html");
 }catch(e){report("เปิดบัญชี QA ไม่สำเร็จ: "+(e?.code||e.message))}
 finally{busy=false;resetUI()}
});
el("logout").addEventListener("click",async()=>{
 if(busy)return;busy=true;resetUI();
 try{await signOut(auth);eligibility=null;report("ออกจากระบบแล้ว")}
 catch(e){report("ออกจากระบบไม่สำเร็จ: "+(e?.code||"error"))}
 finally{busy=false;resetUI()}
});
resetUI();
