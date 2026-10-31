import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,
  signInWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,
  signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const $=id=>document.getElementById(id);
const cfg=window.PACKTOOK_PRODUCTION_CONFIG||{};
const authConfig=cfg.firebase;
const project=String(authConfig?.projectId||"");
const expected=String(cfg.expectedProjectId||"");
const validConfig=cfg.enabled===true&&!!expected&&expected===project
  &&project.includes("prod")&&!/staging|test/i.test(project)
  &&typeof authConfig?.apiKey==="string"&&authConfig.apiKey.length>15
  &&typeof authConfig?.appId==="string"&&authConfig.appId.length>10
  &&authConfig?.authDomain===project+".firebaseapp.com";

const show=id=>{
  for(const name of ["closedPanel","authPanel","signedPanel"])$(name).hidden=name!==id;
};
const message=t=>{$("message").textContent=t};
if(!validConfig){
  show("closedPanel");
  $("closedReason").textContent="Production signup and payments remain disabled. No data from Staging is used.";
}else{
  const app=initializeApp(authConfig),auth=getAuth(app);
  let mode="login",busy=false;
  const registration=cfg.registrationEnabled===true&&cfg.policiesApproved===true;
  const modes={
    login:["เข้าสู่ระบบ PACKTOOK","เข้าสู่ระบบ",true,false],
    signup:["สมัครสมาชิก PACKTOOK","สร้างบัญชีและส่งอีเมลยืนยัน",true,true],
    reset:["ตั้งรหัสผ่านใหม่","ส่งลิงก์รีเซ็ตรหัสผ่าน",false,false]
  };
  function switchMode(next){
    if(busy)return;
    if(next==="signup"&&!registration){message("ยังไม่เปิดรับสมัครสมาชิก กรุณารอประกาศอย่างเป็นทางการ");return;}
    mode=next;const [title,submit,showPassword,showAgreement]=modes[mode];
    $("formTitle").textContent=title;$("submitButton").textContent=submit;
    $("passwordField").hidden=!showPassword;$("password").required=showPassword;
    $("password").autocomplete=mode==="signup"?"new-password":"current-password";
    $("agreement").hidden=!showAgreement;$("agree").required=showAgreement;
    $("agree").checked=false;message("");
  }
  for(const b of document.querySelectorAll("[data-mode]")){
    b.addEventListener("click",()=>switchMode(b.dataset.mode));
    if(b.dataset.mode==="signup"&&!registration){b.disabled=true;b.title="Registration not enabled";}
  }
  $("authForm").addEventListener("submit",async e=>{
    e.preventDefault();if(busy)return;
    if(mode==="signup"&&!registration){message("Registration not enabled");return;}
    busy=true;$("submitButton").disabled=true;message("กำลังดำเนินการ...");
    const email=$("email").value.trim(),password=$("password").value;
    try{
      if(mode==="reset"){
        await sendPasswordResetEmail(auth,email);
        message("หากมีบัญชีนี้ ระบบจะส่งอีเมลตั้งรหัสผ่านใหม่");
      }else if(mode==="signup"){
        if(password.length<12||!$("agree").checked)throw Error("รหัสผ่านต้องมีอย่างน้อย 12 ตัวอักษรและยอมรับนโยบายก่อนสมัคร");
        const result=await createUserWithEmailAndPassword(auth,email,password);
        await sendEmailVerification(result.user);await signOut(auth);
        switchMode("login");
        message("สมัครบัญชีสำเร็จ กรุณายืนยันอีเมลก่อนใช้งาน");
      }else{
        const result=await signInWithEmailAndPassword(auth,email,password);
        if(!result.user.emailVerified){
          await sendEmailVerification(result.user);
          await signOut(auth);
          message("กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ ระบบส่งลิงก์ยืนยันอีกครั้งแล้ว");
        }
      }
    }catch(err){
      const code=String(err?.code||"");
      message(code.includes("too-many-requests")?"มีการลองทำรายการจำนวนมาก กรุณาลองใหม่ภายหลัง":
        code.includes("invalid-credential")?"อีเมลหรือรหัสผ่านไม่ถูกต้อง":
        "ไม่สามารถดำเนินการได้: "+(err?.message||"ตรวจข้อมูลและลองอีกครั้ง"));
    }finally{busy=false;$("submitButton").disabled=false}
  });
  $("signoutButton").addEventListener("click",()=>void signOut(auth));
  onAuthStateChanged(auth,async user=>{
    if(!user){show("authPanel");switchMode("login");return;}
    try{await user.reload();}catch(e){show("authPanel");message("ตรวจสอบอีเมลไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่");return;}
    if(!user.emailVerified){await signOut(auth);show("authPanel");message("กรุณายืนยันอีเมลก่อนใช้งาน");return;}
    $("signedEmail").textContent=user.email||"บัญชี Production";
    show("signedPanel");
  });
}
