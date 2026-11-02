"use strict";
// PACKTOOK V6.5.1 Marketing. No Firebase/Analytics/PII or paid actions.
(function(){
 const year=document.getElementById("year");
 if(year)year.textContent=String(new Date().getFullYear());
 const button=document.getElementById("menuToggle");
 const navigation=document.getElementById("mainNav");
 if(!button||!navigation)return;
 function setMenu(open){
  navigation.classList.toggle("nav-open",open);
  button.setAttribute("aria-expanded",open?"true":"false");
  button.setAttribute("aria-label",open?"ปิดเมนูหลัก":"เปิดเมนูหลัก");
 }
 button.addEventListener("click",()=>setMenu(button.getAttribute("aria-expanded")!=="true"));
 navigation.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>setMenu(false)));
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&button.getAttribute("aria-expanded")==="true"){
   setMenu(false);button.focus();
  }
 });
 document.addEventListener("click",event=>{
  if(!navigation.contains(event.target)&&!button.contains(event.target))setMenu(false);
 });
 const mq=window.matchMedia("(min-width:981px)");
 const onWide=()=>{if(mq.matches)setMenu(false)};
 if(typeof mq.addEventListener==="function")mq.addEventListener("change",onWide);
 else if(typeof mq.addListener==="function")mq.addListener(onWide);
})();
