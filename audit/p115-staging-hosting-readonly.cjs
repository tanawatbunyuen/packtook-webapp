"use strict";
/** P115 read-only staging hosting revision probe.
 * Makes only anonymous GET requests to exactly the staging host.
 * No Cloud Functions requests, auth, API keys, environment mutations, or deploy.
 */
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const host="https://packtook-staging.web.app";
const files=[
 ["firebase-packing-bridge.js","firebase-staging/firebase-packing-bridge.js"],
 ["firebase-v4-config.js","firebase-staging/firebase-v4-config.js"],
 ["index.html","firebase-staging/index.html"]
];
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
async function download(relative){
 const target=new URL("/"+relative,host);
 if(target.origin!==host)throw new Error("NON_STAGING_ORIGIN");
 const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),7000);
 try{
  const res=await fetch(target,{method:"GET",redirect:"manual",signal:ctrl.signal,headers:{"Accept":"text/plain,text/html,*/*"}});
  if(res.status>=300&&res.status<400)return {outcome:"REDIRECT_UNVERIFIED",status:res.status};
  const size=Number(res.headers.get("content-length")||0);
  if(size>1048576)return {outcome:"BODY_TOO_LARGE",status:res.status};
  const buf=Buffer.from(await res.arrayBuffer());
  if(buf.length>1048576)return {outcome:"BODY_TOO_LARGE",status:res.status};
  return {outcome:res.ok?"OK":"HTTP_ERROR",status:res.status,buf};
 }catch(err){return {outcome:"TRANSPORT_ERROR",detail:err?.name||"unknown"}}
 finally{clearTimeout(timer)}
}
(async()=>{
 console.log("P115_MODE=STAGING_HOSTING_ANONYMOUS_READ_ONLY");
 console.log("P115_TARGET="+host);
 let matched=0, drift=0, unavailable=0;
 for(const [remote,local] of files){
  const current=fs.readFileSync(path.join(__dirname,"..",local));
  const result=await download(remote);
  let state;
  if(result.outcome!=="OK"){state=result.outcome;unavailable++;}
  else if(sha(result.buf)===sha(current)){state="EXACT_SOURCE_MATCH";matched++;}
  else{state="HOSTED_SOURCE_DIFFERS";drift++;}
  console.log("P115_FILE="+remote+" STATE="+state+" HTTP="+(result.status??"N/A")+
   " REVIEW_SHA256="+sha(current)+
   " HOST_SHA256="+(result.buf?sha(result.buf):"N/A"));
 }
 console.log("P115_MATCHED="+matched+" P115_DRIFT="+drift+" P115_UNAVAILABLE="+unavailable);
 console.log("P115_DECISION=NO_GO_RUNTIME_NOT_ATTESTED");
 console.log("P115_PRODUCTION_WRITES=0 P115_STAGING_WRITES=0");
})().catch(e=>{console.error("P115_PROBE_INTERNAL_ERROR",e.message);process.exitCode=1});
