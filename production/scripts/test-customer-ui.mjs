// PACKTOOK V6.1.2: the Customer Dashboard excludes local diagnostics UI.
// The recording and video history UX must remain intact.
import fs from "node:fs";
const html=fs.readFileSync(new URL("../app/index.html",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/style.css",import.meta.url),"utf8");
const app=fs.readFileSync(new URL("../app/app.js",import.meta.url),"utf8");
function assert(value,msg){if(!value)throw Error("Customer UI regression: "+msg)}
assert(!html.includes('id="perfPanel"'),"Performance Monitor panel still visible");
assert(!html.includes('performance-monitor.js'),"Performance Monitor script still loaded");
assert(!css.includes("#appPage #perfPanel"),"Performance Monitor CSS still loaded");
assert(!app.includes("PACKTOOK_PERF?.render()"),"Dashboard still renders diagnostics");
for(const id of ["historyRows","dateFilter","barcodeFilter","allVideos","monthVideos","historyVideo","planGrid","cameraBtn","folderBtn"]){
 assert(html.includes('id="'+id+'"'),"Required Customer feature missing: "+id);
}
assert(html.includes('app.js?v=6.5.0')&&html.includes('style.css?v=6.5.0'),"Customer V6.4.3 JS/CSS version mismatch");
assert(html.includes('id="refreshQrAccess"')&&html.includes('id="qrAccessStatus"'),"QR diagnostic status controls missing");
assert(app.includes("async function refreshQrTestAccess()")&&app.includes('tester_permission_missing')&&app.includes('feature_disabled'),"QR access reasons or refresh logic missing");
assert(app.includes("function renderHistory("),"Video history renderer missing");
assert(app.includes("async function startRecording(")&&app.includes("async function stopRecording("),"Barcode workflow missing");
console.log("PASS: PACKTOOK V6.4 retains recording/video dashboard and QR expiry UX");
