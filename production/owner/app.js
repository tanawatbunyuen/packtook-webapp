'use strict';
import {initializeApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,sendEmailVerification,sendPasswordResetEmail,signOut} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getFunctions,httpsCallable} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import {firebaseConfig} from "./firebase-config.js";
if(firebaseConfig.projectId!=="packtook-prod-01"||firebaseConfig.authDomain!=="packtook-prod-01.firebaseapp.com")
 throw Error("Production Owner Firebase config mismatch");

const firebase=initializeApp(firebaseConfig),auth=getAuth(firebase),functions=getFunctions(firebase,"asia-southeast1");
const api=name=>httpsCallable(functions,name,{timeout:190000});
const $=id=>document.getElementById(id);
const fmt=new Intl.NumberFormat("th-TH"),thb=new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0});
let ownerUser=null,summary=null,cursor=null,customerBusy=false,refreshBusy=false,revenueBusy=false,authorized=false;

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
 if(code.includes("not-found")||code.includes("internal"))return "ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจ Cloud Functions และ Log ของ Firebase Production";
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
function expiryLabel(a){
 const state=a.expiryState||(a.plan==="Free"?"no_expiry":"not_set");
 if(state==="no_expiry")return {text:"ไม่มีกำหนด (Free)",cls:"expiry-free"};
 if(state==="not_set")return {text:"ยังไม่กำหนดวันหมดอายุ",cls:"expiry-missing"};
 if(state==="invalid")return {text:"ข้อมูลวันหมดอายุไม่ถูกต้อง",cls:"expiry-missing"};
 const date=dateLabel(a.expiresAt);
 if(state==="expired")return {text:date+" • หมดอายุ",cls:"expiry-expired"};
 if(state==="active")return {text:date+(Number.isSafeInteger(a.daysRemaining)?" • เหลือ "+fmt.format(a.daysRemaining)+" วัน":""),cls:"expiry-active"};
 return {text:date!=="—"?date:"ยังไม่กำหนด",cls:"expiry-missing"};
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
  [p.customers,p.active,p.expired].forEach(v=>tr.append(element("td",fmt.format(v||0))));
  body.append(tr);
 }
}
function renderChart(containerId,months,key){
 const root=$(containerId);root.replaceChildren();
 if(!months.length){root.append(element("p","ยังไม่มีข้อมูลรายเดือน","muted"));return}
 const max=Math.max(1,...months.map(m=>Number(m[key])||0));
 for(const m of months){
  const column=element("div",null,"chart-column"),value=Number(m[key])||0;
  const val=element("span",fmt.format(value),"chart-value");
  const track=element("div",null,"chart-bar-wrap"),bar=element("span",null,"chart-bar");
  bar.style.height=(100*value/max)+"%";
  bar.title=m.month+" : "+(fmt.format(value));
  track.append(bar);
  const label=element("span",new Date(m.month+"-01T12:00:00+07:00").toLocaleDateString("th-TH",{month:"short"}),"chart-label");
  column.append(val,track,label);root.append(column);
 }
}
function renderCharts(){
 if(!summary)return;
 const count=Number($("monthRange").value)||12,months=(summary.months||[]).slice(-count);
 renderChart("customerChart",months,"newCustomers");
}

// V6.2.2 - Owner revenue charts; labels use only values returned by the read-only Production ledger.
const revenueMoney=value=>thb.format(Number.isFinite(Number(value))?Number(value):0);
const revenueAmount=value=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):0;
function revenueEmpty(id,description){
 const host=$(id);host.replaceChildren();
 const empty=element("div",null,"owner-sales-empty");
 empty.append(element("span","▤","owner-sales-empty-icon"),element("strong","ยังไม่มีข้อมูลยอดขาย"),element("span",description,"owner-sales-empty-text"));
 host.append(empty);
 host.setAttribute("aria-label","ยังไม่มีข้อมูลยอดขาย: "+description);
}
function revenueTrack(value,max,kind){
 const track=element("div",null,"owner-sales-track");
 const bar=element("div",null,"owner-sales-fill "+kind);
 bar.style.width=(max>0?100*value/max:0).toFixed(2)+"%";
 track.append(bar);return track;
}
function renderRevenueModeChart(totals){
 const host=$("revenueModeChart");host.replaceChildren();
 const rows=[
  {kind:"live",label:"Live",amount:revenueAmount(totals.liveSalesTHB),count:totals.livePayments||0},
  {kind:"test",label:"Test",amount:revenueAmount(totals.testSalesTHB),count:totals.testPayments||0},
  {kind:"unknown",label:"ไม่ยืนยัน",amount:revenueAmount(totals.unclassifiedSalesTHB),count:totals.unclassifiedPayments||0}
 ];
 const max=Math.max(...rows.map(x=>x.amount));
 if(!max){revenueEmpty("revenueModeChart","ยังไม่พบธุรกรรม Paid ที่มีจำนวนเงินให้แสดง");return}
 for(const item of rows){
  const wrap=element("div",null,"owner-sales-bar-row"),head=element("div",null,"owner-sales-bar-head");
  head.append(element("span",item.label,"owner-sales-name"),element("strong",revenueMoney(item.amount),"owner-sales-value"));
  wrap.append(head,revenueTrack(item.amount,max,item.kind),element("small",(item.count||0)+" รายการ Paid","owner-sales-detail"));
  host.append(wrap);
 }
 host.setAttribute("aria-label",rows.map(r=>r.label+" "+revenueMoney(r.amount)).join(", "));
}
function renderRevenuePlanChart(plans){
 const host=$("revenuePlanChart");host.replaceChildren();
 // Unknown-mode revenue is not exposed by package in the Production ledger API.
 // Never infer it from unclassified count; show only genuinely classified Live/Test amounts.
 const rows=(plans||[]).map(p=>({
  plan:p.plan||"Unknown",live:revenueAmount(p.liveSalesTHB),test:revenueAmount(p.testSalesTHB)
 })).filter(p=>p.live+p.test>0).sort((a,b)=>(b.live+b.test)-(a.live+a.test));
 if(!rows.length){revenueEmpty("revenuePlanChart","ยังไม่มีรายการ Live หรือ Test ที่บันทึกตามแพ็กเกจ");return}
 const max=Math.max(...rows.flatMap(p=>[p.live,p.test]));
 for(const p of rows){
  const item=element("div",null,"owner-sales-plan-row");
  item.append(element("strong",p.plan,"owner-sales-plan-title"));
  for(const [kind,amount,label] of [["live",p.live,"Live"],["test",p.test,"Test"]]){
   const line=element("div",null,"owner-sales-plan-line");
   line.append(element("span",label,"owner-sales-plan-kind"),revenueTrack(amount,max,kind),element("span",revenueMoney(amount),"owner-sales-plan-value"));
   item.append(line);
  }
  host.append(item);
 }
 host.setAttribute("aria-label",rows.map(p=>p.plan+" Live "+revenueMoney(p.live)+" Test "+revenueMoney(p.test)).join("; "));
}
function renderRevenueTrendChart(months){
 const host=$("revenueTrendChart");host.replaceChildren();
 const rows=(months||[]).map(m=>({
  month:m.month||"—",live:revenueAmount(m.liveSalesTHB),test:revenueAmount(m.testSalesTHB),unknown:revenueAmount(m.unclassifiedSalesTHB)
 }));
 const max=Math.max(0,...rows.flatMap(m=>[m.live,m.test,m.unknown]));
 if(!rows.length||max===0){revenueEmpty("revenueTrendChart","รายเดือนยังไม่พบธุรกรรม Paid ที่มีจำนวนเงินให้แสดง");return}
 const board=element("div",null,"owner-sales-trend-board");
 const axes=element("div",null,"owner-sales-trend-plot");
 const top=element("div",revenueMoney(max),"owner-sales-axis-top");
 const bottom=element("div","฿0","owner-sales-axis-bottom");
 axes.append(top,bottom);
 const columns=element("div",null,"owner-sales-trend-columns");
 for(const m of rows){
  const col=element("div",null,"owner-sales-trend-col");
  const bars=element("div",null,"owner-sales-trend-bars");
  for(const kind of ["live","test","unknown"]){
   const amount=m[kind];
   const bar=element("div",null,"owner-sales-trend-bar "+kind);
   bar.style.height=(100*amount/max).toFixed(2)+"%";
   bar.title=m.month+" · "+kind+" · "+revenueMoney(amount);
   bar.setAttribute("aria-label",bar.title);
   bars.append(bar);
  }
  const stamp=/^\d{4}-\d{2}$/.test(m.month)?new Date(m.month+"-01T00:00:00Z"):null;
  const label=stamp&&!Number.isNaN(stamp.getTime())?
   stamp.toLocaleDateString("th-TH",{timeZone:"UTC",month:"short",year:"2-digit"}):m.month;
  col.append(bars,element("span",label,"owner-sales-trend-month"));
  columns.append(col);
 }
 board.append(axes,columns);host.append(board);
 host.setAttribute("aria-label","ยอดขายรายเดือน "+rows.map(m=>m.month+" Live "+revenueMoney(m.live)+" Test "+revenueMoney(m.test)+" ไม่ยืนยัน "+revenueMoney(m.unknown)).join("; "));
}
function renderRevenueReport(data){
 const totals=data.totals||{};
 const n=(totals.livePayments||0)+(totals.testPayments||0)+(totals.unclassifiedPayments||0);
 $("revenueStatus").textContent=data.billingEnabled===false?
  (n?"Production ยังไม่เปิดรับเงินจริง • กราฟใช้เอกสาร Paid ใน Firestore ไม่ใช่ยอดที่กระทบยอดแล้ว":
    "Production ยังไม่เปิดรับชำระเงินจริง และยังไม่มีรายการ Paid ให้แสดงเป็นกราฟ"):
  "ตัวเลขจากเอกสาร Paid ใน Firestore ไม่ใช่ยอดสุทธิหลังคืนเงิน หรือยอดที่กระทบยอดกับธนาคาร";
 const partial=$("revenuePartial");partial.hidden=!data.truncated;
 partial.textContent=data.truncated?
  "รายงานอาจไม่ครบ: มีขีดจำกัดการสแกน 1,200 บัญชี / 100 รายการ Paid ต่อบัญชี • ไม่ควรใช้เป็นตัวเลขทางบัญชี":"";
 renderRevenueModeChart(totals);
 renderRevenuePlanChart(data.plans||[]);
 renderRevenueTrendChart(data.months||[]);
}
async function fetchRevenue(){
 if(!authorized||revenueBusy)return;
 revenueBusy=true;
 const uid=ownerUser?.uid,button=$("reloadRevenue");
 button.disabled=true;button.textContent="กำลังโหลด…";
 $("revenueStatus").textContent="กำลังอ่านข้อมูลธุรกรรม Production…";
 try{
  const response=await api("ownerAnalyticsRevenue")({});
  if(!authorized||ownerUser?.uid!==uid)return;
  renderRevenueReport(response.data);
 }catch(error){
  console.error("Owner revenue load failed",error?.code);
  $("revenueStatus").textContent="โหลดกราฟไม่สำเร็จ: "+errorMessage(error)+" • ไม่สามารถยืนยันยอดได้";
  $("revenuePartial").hidden=true;
  for(const id of ["revenueModeChart","revenuePlanChart","revenueTrendChart"]){
   const host=$(id);host.replaceChildren(element("p","โหลดกราฟไม่สำเร็จ","owner-sales-error"));
   host.setAttribute("aria-label","โหลดกราฟไม่สำเร็จ");
  }
 }finally{
  revenueBusy=false;button.disabled=false;button.textContent="↻ รีเฟรชกราฟ";
 }
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
   row.append(element("td",a.email||"ไม่พบ Email ใน Firebase Auth",a.email?"customer-email":"muted"));
   row.append(element("td",a.accountId,"uid"));
   row.append(element("td",a.plan));
   const status=element("td");status.append(customerStatus(a.status));row.append(status);
   let creditLabel="ตรวจสอบข้อมูล";
   if(a.creditsStatus==="unlimited")creditLabel="∞ ไม่จำกัด";
   else if(a.creditsStatus==="expired")creditLabel="0 (หมดอายุ)";
   else if(a.creditsStatus==="available"&&Number.isSafeInteger(a.creditsRemaining))
    creditLabel=fmt.format(a.creditsRemaining);
   row.append(element("td",creditLabel,"credit-balance"));
   row.append(element("td",Number.isSafeInteger(a.reservedCredits)?fmt.format(a.reservedCredits):"—","credit-reserved"));
   row.append(element("td",dateLabel(a.joinedAt)));
   const expiry=expiryLabel(a);row.append(element("td",expiry.text,expiry.cls));
   body.append(row);
  }
  if(!body.childElementCount){
   const tr=document.createElement("tr"),td=element("td","ยังไม่มีข้อมูลบัญชี");td.colSpan=8;tr.append(td);body.append(tr);
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
  void fetchRevenue();
  void fetchCustomers(true);
 }catch(e){displayLogin("ตรวจสอบสิทธิ์ไม่สำเร็จ: "+errorMessage(e))}
}
$("loginForm").addEventListener("submit",async e=>{
 e.preventDefault();clearError();
 const button=$("loginButton");button.disabled=true;button.textContent="กำลังเข้าสู่ระบบ…";
 try{
  const response=await signInWithEmailAndPassword(auth,$("loginEmail").value.trim(),$("loginPassword").value);
  if(!response.user.emailVerified){await sendEmailVerification(response.user);await signOut(auth);throw Error("ส่งลิงก์ยืนยันอีเมลแล้ว โปรดตรวจกล่องจดหมายก่อนเข้า Owner Dashboard")}
 }catch(e){showError(errorMessage(e))}
 finally{button.disabled=false;button.textContent="เข้าสู่ Owner Dashboard"}
});
$("resetPassword").addEventListener("click",async()=>{
 const email=$("loginEmail").value.trim();
 if(!email)return showError("กรุณากรอกอีเมลก่อนขอรีเซ็ตรหัสผ่าน");
 try{await sendPasswordResetEmail(auth,email);showError("หากมีบัญชีนี้ ระบบจะส่งอีเมลตั้งรหัสผ่านใหม่ให้")}
 catch(e){showError("ส่งลิงก์ไม่สำเร็จ: "+errorMessage(e))}
});
$("logoutButton").addEventListener("click",async()=>{await signOut(auth);displayLogin()});
$("refreshButton").addEventListener("click",()=>{void fetchSummary();void fetchRevenue()});
$("reloadRevenue").addEventListener("click",()=>{void fetchRevenue()});
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
