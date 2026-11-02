// PACKTOOK V6.4.3 — pure Customer UI regression tests; no Firebase writes.
import fs from "node:fs";
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/style.css",import.meta.url),"utf8");
const js=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const assert=(condition,message)=>{if(!condition)throw Error("V6.4.3 navigation/support: "+message)};
for(const id of ["appSidebar","sidebarToggle","sidebarToggleLabel","troubleshooting","troubleSearch","troubleCategory","troubleList","troubleCount","troubleEmpty"]){
 assert(html.includes('id="'+id+'"'),"Missing required UI node "+id);
}
for(const tab of ["packing","dashboard","plans","users","help","troubleshooting"])
 assert(html.includes('data-tab="'+tab+'"'),"Missing navigation tab "+tab);
assert(html.includes('aria-controls="appSidebar"')&&html.includes('aria-expanded="true"'),
 "Sidebar toggle must be accessible to assistive technologies");
// Check the real linked versions rather than pinning this V6.4.3 test to V6.5.0.
// V6.6 updates app.js independently while still using the V6.5 Customer stylesheet.
const jsVersion=html.match(/<script src="app\\.js\\?v=(\\d+)\\.(\\d+)\\.(\\d+)"><\\/script>/);
const cssVersion=html.match(/<link rel="stylesheet" href="style\\.css\\?v=(\\d+)\\.(\\d+)\\.(\\d+)">/);
const supportedAsset=(match)=>match&&
 (Number(match[1])>6||(Number(match[1])===6&&Number(match[2])>=5));
assert(supportedAsset(jsVersion)&&supportedAsset(cssVersion),
 "New UI must invalidate stale cached assets (Customer JS and CSS versions must be >= 6.5.0)");
assert(css.includes("#appPage.sidebar-collapsed .sidebar")&&
 css.includes("#appPage.sidebar-collapsed .main")&&
 css.includes("#appPage.sidebar-collapsed .sidebar{display:none}"),
 "Sidebar collapse must reclaim main content area and work on mobile");
assert(css.includes("@media(prefers-reduced-motion:reduce)"),"Respect reduced-motion setting");
assert(js.includes("troubleshooting:'แก้ปัญหาเบื้องต้น'"),"Troubleshooting page title missing");
assert(js.includes("document.querySelectorAll('[data-troubleshoot-goto]')"),"Support navigation links not bound");
const topics=[...html.matchAll(/<details class="trouble-item" data-category="([^"]+)" data-keywords="([^"]+)">/g)];
assert(topics.length>=12,"Expected at least twelve symptom-based articles");
const categoryKeys=new Set(topics.map(x=>x[1]));
for(const key of ["account","camera","barcode","storage","credit","device","payment","network"])
 assert(categoryKeys.has(key),"Support topic missing category "+key);
const support=html.slice(html.indexOf('<section id="troubleshooting"'),html.indexOf('</section>',html.indexOf('<section id="troubleshooting"')));
assert(support.includes("Credit Recovery")&&support.includes("QR ยังแสดง Pending")&&support.includes("10 วัน"),
 "Critical customer credit/payment guidance missing");
for(const technical of ["Firebase","Firestore","Cloud Shell","GitHub","Secret Key","IndexedDB","Production Beta","node scripts"]){
 assert(!support.includes(technical),"Customer-facing help should not contain backend terminology: "+technical);
}
assert(support.includes("ทีมช่วยเหลือ PACKTOOK")&&support.includes("ก่อนติดต่อทีมช่วยเหลือ"),
 "Support content should be written directly for customer self-service");
const begin=js.indexOf("const SIDEBAR_LAYOUT_KEY="),end=js.indexOf("function showTab(",begin);
assert(begin>=0&&end>begin,"UI-only helper source boundary missing");
const classes=new Set(),values={},saved={};
const page={classList:{
 toggle:(name,on)=>on?classes.add(name):classes.delete(name),
 contains:name=>classes.has(name)
}};
const button={title:"",setAttribute:(name,value)=>{values[name]=value}};
const label={textContent:""};
const textInput={value:""},category={value:"all"};
const count={textContent:""},empty={hidden:true};
const entries=topics.map(x=>({dataset:{category:x[1],keywords:x[2]},textContent:x[2],hidden:false}));
const nodes={appPage:page,sidebarToggle:button,sidebarToggleLabel:label,
 troubleSearch:textInput,troubleCategory:category,troubleCount:count,troubleEmpty:empty};
const document={querySelectorAll:selector=>{
 if(selector!=="#troubleList .trouble-item")throw Error("Unexpected selector "+selector);
 return entries;
}};
const localStorage={setItem:(key,value)=>{saved[key]=value}};
const helpers=new Function("document","localStorage","$",js.slice(begin,end)+
 ";return {setSidebarCollapsed,filterTroubleshooting};"
)(document,localStorage,id=>nodes[id]);
helpers.setSidebarCollapsed(true);
assert(classes.has("sidebar-collapsed")&&values["aria-expanded"]==="false"&&
 button.title==="ขยายแถบเมนู"&&saved["packtook-sidebar-collapsed-v643"]==="1",
 "Collapse state/labels/storage failed");
helpers.setSidebarCollapsed(false);
assert(!classes.has("sidebar-collapsed")&&values["aria-expanded"]==="true"&&
 saved["packtook-sidebar-collapsed-v643"]==="0",
 "Expand state/labels/storage failed");
helpers.filterTroubleshooting();
assert(entries.every(x=>!x.hidden)&&count.textContent==="พบ "+topics.length+" หัวข้อ",
 "Empty search should show all articles");
category.value="camera";helpers.filterTroubleshooting();
assert(entries.filter(x=>!x.hidden).length===topics.filter(x=>x[1]==="camera").length,
 "Camera category filter failed");
category.value="all";textInput.value="QR code";helpers.filterTroubleshooting();
assert(entries.filter(x=>!x.hidden).length>0&&entries.filter(x=>!x.hidden).every(x=>x.dataset.category==="payment"),
 "Text search must locate payment guidance");
textInput.value="NOT_A_REAL_ISSUE";helpers.filterTroubleshooting();
assert(entries.every(x=>x.hidden)&&empty.hidden===false,
 "No-result state must appear for unmatched search");
console.log("PASS: V6.4.3 accessible compact sidebar, state persistence, mobile layout, 14 searchable support cases");
