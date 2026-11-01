// PACKTOOK V6.2.2: source-level and simulated-DOM smoke test for Owner Revenue Charts.
// No live Firebase or payment data is required, and this test never modifies Production.
import fs from "node:fs";
const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),"utf8");
const html=read("../owner/index.html");
const app=read("../owner/app.js");
const style=read("../owner/style.css");
function check(test,msg){if(!test)throw new Error("V6.2.2 Owner charts: "+msg)}
for(const id of ["revenueModeChart","revenuePlanChart","revenueTrendChart","revenueStatus","revenuePartial","reloadRevenue"]){
 check(html.includes('id="'+id+'"'),"Required chart UI "+id+" missing");
}
for(const old of ["revenueLive","revenueTest","revenueUnknown","revenueTransactions","revenueMonthly","revenuePlanRows"]){
 check(!html.includes('id="'+old+'"'),"Legacy numeric/table component "+old+" still rendered");
}
check(html.includes("app.js?v=6.2.2")&&html.includes("style.css?v=6.2.2"),"Chart files not cache-busted");
check(!/packtook-staging|firebase-staging/.test(html+app),"Owner chart not isolated to Production");
check(style.includes(".owner-sales-trend-bars")&&style.includes(".owner-sales-empty"),"Chart styles or zero state missing");
check(app.includes('api("ownerAnalyticsRevenue")'),"Revenue must use existing read-only Owner endpoint");
check(!/api\("(createOmisePayment|ownerAdjustCredits|requestPlanChange)"\)/.test(app),"Payment/wallet mutations forbidden");
const start=app.indexOf("const revenueMoney=");
const end=app.indexOf("\nasync function fetchSummary(){",start);
check(start>0&&end>start,"Revenue chart renderers not found");
const source=app.slice(start,end);
const nodes=new Map();
function fakeNode(tag="div",value=null,cls=""){
 return {tag,className:cls,textContent:value===null?"":String(value),style:{},attributes:{},hidden:false,children:[],
  append(...items){this.children.push(...items)},
  replaceChildren(...items){this.children=[...items]},
  setAttribute(k,v){this.attributes[k]=v}};
}
function $(id){if(!nodes.has(id))nodes.set(id,fakeNode("div"));return nodes.get(id)}
const element=(tag,value,cls)=>fakeNode(tag,value,cls);
const thb=new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0});
const fmt=new Intl.NumberFormat("th-TH");
const {renderRevenueReport,renderRevenueModeChart,renderRevenuePlanChart,renderRevenueTrendChart}=
 new Function("$","element","thb","fmt","api","errorMessage","console",
 source+"\nreturn {renderRevenueReport,renderRevenueModeChart,renderRevenuePlanChart,renderRevenueTrendChart};")
 ($,element,thb,fmt,()=>{},()=>"",console);
const zero={
 billingEnabled:false,truncated:false,totals:{liveSalesTHB:0,testSalesTHB:0,unclassifiedSalesTHB:0,
  livePayments:0,testPayments:0,unclassifiedPayments:0},
 plans:[],months:[{month:"2026-11",liveSalesTHB:0,testSalesTHB:0,unclassifiedSalesTHB:0}]
};
renderRevenueReport(zero);
check(["revenueModeChart","revenuePlanChart","revenueTrendChart"].every(id=>$(id).children.length===1&&$(id).children[0].className==="owner-sales-empty"),"Zero transactions must render three explicit empty chart states");
check($("revenueStatus").textContent.includes("ยังไม่มีรายการ Paid"),"Zero transactions must be clearly explained");
const fixture={
 billingEnabled:false,truncated:false,
 totals:{liveSalesTHB:199,testSalesTHB:398,unclassifiedSalesTHB:150,
   livePayments:1,testPayments:2,unclassifiedPayments:1},
 plans:[{plan:"Starter",liveSalesTHB:199,testSalesTHB:299,unclassifiedPayments:1},
  {plan:"Basic",liveSalesTHB:0,testSalesTHB:99,unclassifiedPayments:0}],
 months:[{month:"2026-11",liveSalesTHB:199,testSalesTHB:398,unclassifiedSalesTHB:150},
  {month:"2026-12",liveSalesTHB:0,testSalesTHB:0,unclassifiedSalesTHB:0}]
};
renderRevenueReport(fixture);
check($("revenueModeChart").children.length===3,"Mode chart should contain Live/Test/Unknown bars");
const modeFirst=$("revenueModeChart").children[0];
check(modeFirst.children[1].children[0].style.width==="50.00%","Mode chart should scale real amounts");
check($("revenuePlanChart").children.length===2,"Paid package categories should be graphed without fictitious ones");
check($("revenueTrendChart").children[0].className==="owner-sales-trend-board","Monthly data must render chart");
const cols=$("revenueTrendChart").children[0].children[1].children;
check(cols.length===2&&cols[0].children[0].children.length===3,"Each month must have three distinct bars");
check(cols[0].children[0].children[1].style.height==="100.00%","Monthly chart must scale to largest measured revenue");
check(cols[1].children[0].children.every(b=>b.style.height==="0.00%"),"Zero-valued month must not invent visible bars");
check($("revenueStatus").textContent.includes("ไม่ใช่ยอดที่กระทบยอดแล้ว"),"Live-sounding values must be qualified");
console.log("PASS: PACKTOOK V6.2.2 revenue graphs, zero states, and read-only safety");
