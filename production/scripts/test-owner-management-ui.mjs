// PACKTOOK V6.2.3 UI smoke test (no Firebase or browser needed).
import fs from "node:fs";
const app=fs.readFileSync(new URL("../owner/app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../owner/index.html",import.meta.url),"utf8");
const assert=(ok,msg)=>{if(!ok)throw Error("Owner management UI: "+msg)};
for(const id of ["ownerManageStatus","managePanel","manageForm","manageAction","manageSubmit","manageConfirmEmail","manageExpiryDate","manageCreditAmount","manageHistory"]){
 assert(html.includes('id="'+id+'"'),"Missing UI element "+id);
}
assert(html.includes("app.js?v=6.4.1")&&html.includes("style.css?v=6.4.1"),"Owner V6.4 asset cache version mismatch");
assert(app.includes('api("ownerManagementStatus")')&&app.includes('api("ownerManageCustomer")')&&app.includes('api("ownerCustomerManagementHistory")'),"Missing Owner management callables");
assert(app.includes("crypto.randomUUID()"),"Idempotent operation identifier missing");
assert(app.includes("window.confirm("),"Operator confirmation missing");
const start=app.indexOf("async function fetchManagementStatus(){"),end=app.indexOf("async function fetchCustomers(",start);
assert(start>=0&&end>start,"Customer management logic missing");
const snippet=app.slice(start,end);
const nodes=new Map();
const $=id=>{
 if(!nodes.has(id))nodes.set(id,{hidden:false,disabled:false,value:"",textContent:"",append(){},replaceChildren(){},scrollIntoView(){}});
 return nodes.get(id);
};
const wrapper=[
 'let canManageCustomers=true,selectedManagedAccount=null,pendingManagementId="old-id";',
 'const customerDirectory=new Map();',
 'const fmt=new Intl.NumberFormat("th-TH");',
 'const api=()=>()=>Promise.resolve({data:{items:[]}});',
 'const element=()=>({});',
 'const expiryLabel=()=>({text:"Free"});',
 'const ownerUser={uid:"owner"};',
 'const authorized=true;',
 snippet,
 'return {updateManagementFields,setAccount:a=>{selectedManagedAccount=a}};'
].join("\n");
const sandbox=new Function("$","console",wrapper)($,console);
sandbox.setAccount({plan:"Free",walletEnabled:false,creditsStatus:"available",creditsRemaining:18,reservedCredits:0});
$("manageAction").value="grant_credits";
sandbox.updateManagementFields();
assert($("manageSubmit").disabled===true,"Legacy monthly Free grants must be disabled");
assert($("manageResult").textContent.includes("โควตารายเดือน"),"Free quota warning missing");
sandbox.setAccount({plan:"Starter",walletEnabled:true,creditsStatus:"available",creditsRemaining:42,reservedCredits:0});
sandbox.updateManagementFields();
assert($("manageSubmit").disabled===false,"Active wallet grants should be enabled");
$("manageAction").value="set_expiry";
sandbox.updateManagementFields();
assert($("manageSubmit").disabled===false,"Paid expiry should be editable");
assert($("manageExpiryGroup").hidden===false&&$("manageCreditsGroup").hidden===true,"Expiry-only input should be shown");
sandbox.setAccount({plan:"Starter",walletEnabled:true,creditsStatus:"available",creditsRemaining:42,reservedCredits:1});
sandbox.updateManagementFields();
assert($("manageSubmit").disabled===true,"Adjustments must be blocked during reserved recording");
console.log("PASS: V6.2.3 Owner manager UI gating, monthly Free quota, paid expiry, pending recording");
