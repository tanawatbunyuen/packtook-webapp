"use strict";
// Offline, operator-workstation-only, sanitized JSON metadata. Never print raw evidence.
const fs=require("node:fs"),path=require("node:path");
const {reconcile}=require("./reconcile");
try{
 if(process.argv.length>3)throw Error("P195_USAGE");
 const file=process.argv[2];
 if(!file){console.log("P195_STAGING_EVIDENCE="+JSON.stringify(reconcile()));process.exit(0)}
 if(process.env.CI==="true"||process.env.GITHUB_ACTIONS==="true")
  throw Error("P195_CI_EXTERNAL_EVIDENCE_DENIED");
 const filePath=path.resolve(file),stat=fs.lstatSync(filePath);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size>8192)
  throw Error("P195_UNTRUSTED_OR_OVERSIZE_EVIDENCE");
 const parsed=JSON.parse(fs.readFileSync(filePath,"utf8"));
 // Always return classifications only, not operator supplied raw text.
 console.log("P195_STAGING_EVIDENCE="+JSON.stringify(reconcile({observations:parsed,now:new Date().toISOString()})));
 console.log("P195_NO_GO_RELEASE=TRUE");
}catch(e){
 const code=/^P195_/.test(e.message)?e.message:"P195_INVALID_INPUT_REDACTED";
 console.error("P195_REJECTED="+code);process.exitCode=1;
}
