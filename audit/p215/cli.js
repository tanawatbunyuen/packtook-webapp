"use strict";
const {preflight,markdown}=require("./preflight");
const r=preflight();
if(process.argv.length!==2||r.classification!=="SAFE_TO_HANDOFF_NOT_SAFE_TO_RELEASE"){
 console.error("P215_BLOCK=PRECHECK_FAILED");process.exitCode=1;
}else{
 process.stdout.write(markdown(r));
 console.log("P215_REVIEW_HANDOFF_READY=LOCAL_ONLY");
 console.log("P215_G02=NO_GO_RELEASE");
}
