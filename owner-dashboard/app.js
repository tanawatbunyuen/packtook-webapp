'use strict';
import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-config.js";

const firebase=initializeApp(firebaseConfig),auth=getAuth(firebase),functions=getFunctions(firebase,"asia-southeast1");
const api=name=>httpsCallable(functions,name,{timeout:190000});
const $=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat("th-TH"),baht=new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0});
let ownerUser=null,summary=null,cursor=null,customerBusy=false,refreshBusy=false,authorized=false;

function element(tag,value,cls){
 const e=document.createElement(tag);
 if(value!==undefined&&value!==null)e.textContent=String(value);
 if(cls)e.className=cls;
 return e;
}
function errorMessage(error){
 const code=String(error?.code||"");
 if(code.includes("permission-denied"))return "บัญชีนี้ไม่ได้รับสิทธิ์ Platform Owner กรุณาตรวจสอบสิทธิ์กับผู้ดูแล Firebase";
 if(code.includes("unauthenticated"))return "กรุณาเข้าสู่ระบบด้วยบัญชี Owner ที่ยืนยันอีเมลแล้ว";
 if(code.includes("not-found")||code.includes("internal"))return "ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจ Cloud Functions และ Log บน Firebase Staging";
 if(code.includes("invalid-credential")||code.includes("wrong-password"))return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
 return error?.message||"เกิดข้อผิดพลาดในการเชื่อมต่อ Firebase";
}
function showError(message){
 const el=$("loginError");el.textContent=message;el.hidden=false;
}
function clearError(){const el=$("loginError");el.textContent="";el.hidden=true}
function displayLogin(message=""){
 authorized=false;ownerUser=null;$("ownerApp").hidden=true;$("loginScreen").hidden=false;
 if(message)showError(message);else clearError();
}
function displayDashboard(user){
 ownerUser=user;authorized=true;$("loginScreen").hidden=true;$("ownerApp").hidden=false;
 $("currentEmail").textContent=user.email||"Platform Owner";
}
function dateLabel(iso){
 if(!iso)return "—";
 const dt=new Date(iso);
 return Number.isFinite(dt.getTime())?dt.toLocaleDateString("th-TH",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",year:"numeric"}):"—";
}
function number(id,value){
 $(id).textContent=fmt.format(Number(value)||0);
}
function customerStatus(value){
 const labels={active:"Active",expired:"หมดอายุ",free:"Free",invalid:"ตรวจสอบข้อมูล",unconfigured:"ยังไม่กำหนด"};
 return element("span",labels[value]||value||"—","badge badge-"+(value==="active"?"active":value==="expired"?"expired":value==="free"?"free":"other"));
}
function renderSummary(data){
 summary=data;
 const t=data.totals||{};
 number("totalCustomers",t.customers);number("activeCustomers",t.activePaid);
 number("freeCustomers",t.free);number("expiredCustomers",t.expiredPaid);
 $("testRevenue").textContent=baht.format(t.testSalesTHB||0);
 $("testTransactions").textContent=fmt.format(t.testPayments||0)+" รายการทดสอบที่บันทึกว่าชำระแล้ว";
 $("realRevenue").textContent=baht.format(t.liveSalesTHB||0);
 $("lastUpdate").textContent="ข้อมูล ณ "+new Date(data.asOf).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"});
 const partial=$("partialNotice");
 partial.hidden=!data.truncated;
 partial.textContent=data.truncated?"รายงานนี้เป็นข้อมูลบางส่วน: สแกนได้ "+fmt.format(data.scannedAccounts)+" บัญชี จากขีดจำกัด "+fmt.format(data.maxScannedAccounts)+" บัญชี กรุณาพัฒนาระบบสรุปยอดแบบรายวันก่อนใช้กับฐานลูกค้าขนาดใหญ่":"";
 renderCharts();
 renderPlanTable(data.plans||[]);
}
const planIcons={Free:"🌱",Starter:"🚀",Basic:"🛡",Growth:"📈",Business:"🏢",Pro:"👑"};
function renderPlanTable(plans){
 const body=$("planRows");body.replaceChildren();
 for(const p of plans){
  const tr=document.createElement("tr"),name=element("td");
  name.append(element("span",planIcons[p.plan]||"◈","plan-symbol"),document.createTextNode(p.plan));
  tr.append(name);
  [p.customers,p.active,p.expired,p.testPayments].forEach(v=>tr.append(element("td",fmt.format(v||0))));
  tr.append(element("td",baht.format(p.testSalesTHB||0),"money"));
  body.append(tr);
 }
}
function renderChart(containerId,months,key,isMoney=false){
 const root=$(containerId);root.replaceChildren();
 if(!months.length){root.append(element("p","ยังไม่มีข้อมูลรายเดือน","muted"));return}
 const max=Math.max(1,...months.map(m=>Number(m[key])||0));
 for(const m of months){
  const column=element("div",null,"chart-column"),value=Number(m[key])||0;
  const val=element("span",isMoney?baht.format(value):fmt.format(value),"chart-value");
  const track=element("div",null,"chart-bar-wrap"),bar=element("span",null,"chart-bar"+(isMoney?" test":""));
  bar.style.height=(100*value/max)+"%";
  bar.title=m.month+" : "+(isMoney?baht.format(value):fmt.format(value));
  track.append(bar);
  const label=element("span",new Date(m.month+"-01T12:00:00+07:00").toLocaleDateString("th-TH",{month:"short"}),"chart-label");
  column.append(val,track,label);root.append(column);
 }
}
function renderCharts(){
 if(!summary)return;
 const count=Number($("monthRange").value)||12,months=(summary.months||[]).slice(-count);
 renderChart("customerChart",months,"newCustomers");
 renderChart("testSalesChart",months,"testSalesTHB",true);
}
async function fetchSummary(){
 if(!authorized||refreshBusy)return;
 refreshBusy=true;const button=$("refreshButton");
 button.disabled=true;button.textContent="กำลังคำนวณข้อมูล…";
 try{
  const result=await api("ownerAnalyticsSummary")({});
  if(!authorized)return;
  renderSummary(result.data);
 }catch(e){
  console.error("Owner analytics summary failed",e.code);
  $("lastUpdate").textContent="โหลดรายงานไม่สำเร็จ: "+errorMessage(e);
 }finally{
  refreshBusy=false;button.disabled=false;button.textContent="↻ รีเฟรชข้อมูล";
 }
}
async function fetchCustomers(reset=false){
 if(!authorized||customerBusy)return;
 customerBusy=true;
 const more=$("moreCustomers"),body=$("customerRows");
 more.disabled=true;
 if(reset){cursor=null;body.replaceChildren();$("customerPageStatus").textContent="กำลังโหลดสมาชิก…"}
 try{
  const res=await api("ownerAnalyticsCustomers")({afterId:cursor});
  if(!authorized)return;
  const result=res.data;
  for(const a of result.customers||[]){
   const row=document.createElement("tr");
   row.append(element("td",a.accountId,"uid"));
   row.append(element("td",a.plan));
   const status=element("td");status.append(customerStatus(a.status));row.append(status);
   row.append(element("td",dateLabel(a.joinedAt)));
   row.append(element("td",dateLabel(a.expiresAt)));
   body.append(row);
  }
  if(!body.childElementCount){
   const tr=document.createElement("tr"),td=element("td","ยังไม่มีข้อมูลบัญชี");td.colSpan=5;tr.append(td);body.append(tr);
  }
  cursor=result.nextCursor||null;
  more.hidden=!cursor;
  $("customerPageStatus").textContent=fmt.format(body.querySelectorAll("tr").length)+" บัญชีที่แสดง · เรียงตามรหัสบัญชี";
 }catch(e){
  console.error("Owner customer list failed",e.code);
  $("customerPageStatus").textContent="โหลดรายชื่อลูกค้าไม่สำเร็จ: "+errorMessage(e);
 }finally{customerBusy=false;more.disabled=false}
}
async function ensureAccess(user){
 try{
  const token=await user.getIdTokenResult(true);
  if(token.claims.packtookPlatformOwner!==true){
   displayLogin("บัญชีนี้ไม่มีสิทธิ์ Platform Owner โปรดให้ผู้ดูแลกำหนดสิทธิ์ผ่าน Firebase Admin SDK");
   return;
  }
  displayDashboard(user);
  void fetchSummary();
  void fetchCustomers(true);
 }catch(e){displayLogin("ตรวจสอบสิทธิ์ไม่สำเร็จ: "+errorMessage(e))}
}
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();clearError();
 const button=$("loginButton");button.disabled=true;button.textContent="กำลังเข้าสู่ระบบ…";
 try{
  const response=await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);
  if(!response.user.emailVerified){await signOut(auth);throw Error("กรุณายืนยันอีเมล Firebase ก่อนใช้ Owner Dashboard")}
 }catch(e){showError(errorMessage(e))}
 finally{button.disabled=false;button.textContent="เข้าสู่ Owner Dashboard"}
});
$("logoutButton").addEventListener("click",async()=>{await signOut(auth);displayLogin()});
$("refreshButton").addEventListener("click",()=>{void fetchSummary()});
$("reloadCustomers").addEventListener("click",()=>{void fetchCustomers(true)});
$("moreCustomers").addEventListener("click",()=>{void fetchCustomers()});
$("monthRange").addEventListener("change",renderCharts);
const links=[...document.querySelectorAll(".sidebar-link")];
for(const link of links)link.addEventListener("click",()=>{links.forEach(l=>l.classList.toggle("active",l===link))});
onAuthStateChanged(auth,user=>{
 if(!user){displayLogin();return}
 if(!user.emailVerified){displayLogin("ต้องยืนยันอีเมลก่อนเข้าใช้งาน");return}
 void ensureAccess(user);
});
