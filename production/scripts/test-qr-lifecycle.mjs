// V6.3.2 — Browser-free regression of QR lifecycle.
// Payment backend, Firebase account and billing ledger are never modified.
import fs from "node:fs";
const app=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/style.css",import.meta.url),"utf8");
const assert=(ok,message)=>{if(!ok)throw Error("V6.4 QR lifecycle: "+message)};
assert(html.includes('id="paymentQrResult"')&&html.includes("aria-live=")&&html.includes("hidden></div>"),"QR panel should initially be hidden");
assert(html.includes("app.js?v=6.4.0")&&html.includes("style.css?v=6.4.0"),"QR lifecycle assets must be cache-busted");
assert(css.includes("#paymentQrResult[hidden]"),"Hidden QR must not leave empty white panel");
assert(!app.includes("displayOmiseQR(result.qrImage)"),"QR displays must be bound to request ID");
assert(app.includes("syncDisplayedPaymentQr(details)")&&app.includes('finishDisplayedPaymentQr("paid",requestId)'),"History/recheck must clear completed QR");
const begin=app.indexOf("// V6.3.2 — The QR is transient UI");
const end=app.indexOf("async function startOmiseUI(",begin);
assert(begin>0&&end>begin,"QR lifecycle functions not found");
const code=app.slice(begin,end);
const elements=new Map();
function el(tag){
 return {tag,textContent:"",id:"",className:"",style:{},hidden:false,children:[],
  append(...nodes){this.children.push(...nodes)},replaceChildren(...nodes){this.children=[...nodes]},
  scrollIntoView(){}};
}
const host=el("div"),plans=el("div");
elements.set("paymentQrResult",host);elements.set("plans",plans);
const $=id=>elements.get(id)||null;
const user={uid:"customer-test"};
let providerStatus="pending",providerCalls=0,quotaRefreshes=0,pageRefreshes=0;
const api={omisePaymentStatus:async id=>{providerCalls++;return {status:providerStatus,requestId:id}}};
const credit=()=>api;
const refreshRemoteQuota=async()=>{quotaRefreshes++};
const renderSubscriptionRequests=async()=>{pageRefreshes++};
const queues=new Map();let timerCounter=0;
function setTimeout(fn,ms){const n=++timerCounter;queues.set(n,{fn,ms});return n}
function clearTimeout(id){queues.delete(id)}
const document={createElement:el,hidden:false};
const runtime=new Function(
 "$","document","remoteUser","credit","refreshRemoteQuota","renderSubscriptionRequests","setTimeout","clearTimeout","console","URL",
 code+"\nreturn {displayOmiseQR,clearDisplayedPaymentQr,finishDisplayedPaymentQr,syncDisplayedPaymentQr,checkDisplayedPaymentQr,qrState:()=>displayedPaymentQr};"
)($,document,user,credit,refreshRemoteQuota,renderSubscriptionRequests,setTimeout,clearTimeout,console,URL);
const getText=()=>host.children.map(n=>n.textContent).join(" ");
runtime.displayOmiseQR("https://api.omise.co/mockqr.png","order-1","2027-01-01T00:00:00.000Z");
assert(host.children.some(x=>x.className==="qr-expiry-info"),"Provider QR expiry must display in Thai timezone");
assert(!host.hidden&&host.children.some(x=>x.tag==="img"),"QR must appear for pending order");
assert(runtime.qrState()?.requestId==="order-1","QR must store its order ID");
assert(queues.size===1,"Pending QR must schedule exactly one refresh");
runtime.syncDisplayedPaymentQr({requests:[{id:"other-order",status:"paid"}]});
assert(host.children.some(x=>x.tag==="img"),"Paid unrelated order must not clear active QR");
runtime.syncDisplayedPaymentQr({requests:[{id:"order-1",status:"paid"}]});
assert(!host.children.some(x=>x.tag==="img")&&getText().includes("ยืนยันการชำระเงินสำเร็จ"),"Paid order must replace QR with success");
assert(queues.size===0&&runtime.qrState()===null,"Paid order must terminate polling");
runtime.displayOmiseQR("https://api.omise.co/new.png","order-2");
runtime.finishDisplayedPaymentQr("paid","order-1");
assert(runtime.qrState()?.requestId==="order-2","Stale paid response must not clear a new QR");
providerStatus="paid";
await runtime.checkDisplayedPaymentQr();
assert(!host.children.some(x=>x.tag==="img")&&getText().includes("สำเร็จ"),"Provider-paid event must clear QR");
assert(quotaRefreshes===1&&pageRefreshes===1,"Provider-paid event must reload customer state");
assert(queues.size===0,"Provider-paid event must stop monitoring");
runtime.displayOmiseQR("https://api.omise.co/new.png","order-3");
providerStatus="expired";
await runtime.checkDisplayedPaymentQr();
assert(!host.children.some(x=>x.tag==="img")&&getText().includes("หมดอายุ"),"Expired QR must disappear, not show success");
runtime.displayOmiseQR("https://api.omise.co/new.png","order-4");
user.uid="different-user";
const beforeCalls=providerCalls;
await runtime.checkDisplayedPaymentQr();
assert(host.hidden&&!host.children.length&&providerCalls===beforeCalls,"Different user must not see previous account QR");
user.uid="customer-test";
runtime.displayOmiseQR("https://api.omise.co/new.png","order-5");
providerStatus="pending";document.hidden=true;
const n=queues.keys().next().value;
const timer=queues.get(n);queues.delete(n);
timer.fn();
assert(providerCalls===beforeCalls,"Hidden browser must not poll payment API");
assert(queues.size===1,"Hidden browser should retain delayed check");
runtime.clearDisplayedPaymentQr();
assert(host.hidden&&queues.size===0,"Logout/close must remove QR and cancel pending work");
console.log("PASS: V6.3.2 QR cleanup on paid/expired, per-order safety, polling, background pause and logout");
