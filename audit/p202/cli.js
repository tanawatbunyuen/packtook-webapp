"use strict";
const fs=require("node:fs"),path=require("node:path");
const {consolidate}=require("./reconcile");
try{
 if(process.argv.length>3)throw Error("P202_USAGE");
 const file=process.argv[2];
 if(!file){
  console.log("P202_REVIEW_PACKET="+JSON.stringify(consolidate()));
 }else{
  if(process.env.CI==="true"||process.env.GITHUB_ACTIONS==="true")
   throw Error("P202_CI_EXTERNAL_EVIDENCE_DENIED");
  const p=path.resolve(file),s=fs.lstatSync(p);
  if(!s.isFile()||s.isSymbolicLink()||s.size>8192)throw Error("P202_UNTRUSTED_INPUT");
  const o=JSON.parse(fs.readFileSync(p,"utf8"));
  console.log("P202_REVIEW_PACKET="+JSON.stringify(consolidate({claims:o})));
 }
 console.log("P202_RELEASE_GATES=NO_GO");
}catch(e){
 const msg=typeof e.message==="string"&&e.message.startsWith("P202_")?e.message:"P202_INVALID_INPUT_REDACTED";
 console.error("P202_BLOCK="+msg);process.exitCode=1;
}
