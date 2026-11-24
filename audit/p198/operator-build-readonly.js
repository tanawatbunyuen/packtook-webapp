"use strict";
// Operator-only fixed Cloud Build metadata read. Never called in CI or silently.
const {execFileSync}=require("node:child_process");
const {authorize,ACK}=require("../p196/operator-readonly-runtime");
const {BUILD,PROJECT}=require("./verify");
const BUILD_ID=BUILD.slice(BUILD.lastIndexOf("/")+1);
function fetchBuild({env=process.env,ticket,exec=execFileSync}={}){
 authorize({env,project:PROJECT,ack:ACK,ticket});
 if(env.PACKTOOK_G02_P198_BUILD_READ_ONLY_ACK!=="I_AUTHORIZE_P198_STAGING_BUILD_METADATA_READ_ONLY")
  throw Error("P198_EXPLICIT_BUILD_READ_ACK_MISSING");
 const argv=["builds","describe",BUILD_ID,"--project",PROJECT,"--region",
 "asia-southeast1","--format=json","--quiet"];
 const raw=exec("gcloud",argv,{encoding:"utf8",timeout:12000,maxBuffer:512*1024,env:{
  ...env,CLOUDSDK_CORE_PROJECT:PROJECT
 }});
 if(typeof raw!=="string"||Buffer.byteLength(raw)>512*1024)throw Error("P198_BUILD_RESPONSE_TOO_LARGE");
 try{return JSON.parse(raw)}catch{throw Error("P198_INVALID_BUILD_RESPONSE")}
}
module.exports={fetchBuild,BUILD_ID};
