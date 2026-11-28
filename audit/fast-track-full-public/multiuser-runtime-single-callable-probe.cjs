"use strict";
/**
 * Local-only one-Callable runtime loader probe, for root-cause isolation.
 * No Firebase credentials or tokens. No Firestore writes.
 */
const p="demo-packtook-integrated-01";
const check=h=>/^(127\.0\.0\.1|localhost):[0-9]{2,5}$/.test(h||"");
if((process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT)!==p||
 !check(process.env.FIRESTORE_EMULATOR_HOST)||
 !check(process.env.FIREBASE_AUTH_EMULATOR_HOST)||
 !check(process.env.FIREBASE_EMULATOR_HUB)){
 console.error("PACKTOOK_RUNTIME_SINGLE_PROBE=DENIED_NONLOCAL_CONFIG");
 process.exit(2);
}
const base="http://127.0.0.1:5001/"+p+"/asia-southeast1/usageStatus";
async function main(){
 console.log("PACKTOOK_RUNTIME_SINGLE_PROBE_START=usageStatus");
 console.log("PACKTOOK_RUNTIME_NODE="+process.version);
 try{
  const r=await fetch(base,{method:"POST",headers:{"content-type":"application/json"},
    body:'{"data":{}}',signal:AbortSignal.timeout(45000)});
  const body=await r.text();
  console.log("PACKTOOK_RUNTIME_SINGLE_PROBE_HTTP="+r.status);
  console.log("PACKTOOK_RUNTIME_SINGLE_PROBE_BODY="+body.slice(0,350));
  if(![400,401,403].includes(r.status))throw Error("Unexpected HTTP status "+r.status);
  console.log("PACKTOOK_RUNTIME_SINGLE_PROBE_UNAUTH_REJECTION=PASS");
  console.log("PACKTOOK_RUNTIME_AUTHORIZED_TESTS=NOT_EXECUTED");
  console.log("PACKTOOK_DEPLOY=NOT_PERFORMED");
  console.log("PACKTOOK_FULL_PUBLIC=NO_GO");
 }catch(e){console.error("PACKTOOK_RUNTIME_SINGLE_PROBE_FAILURE="+e.stack);process.exitCode=2;}
}
main();
