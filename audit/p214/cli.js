"use strict";
const {inspect,markdown}=require("./packet");
const result=inspect();
if(process.argv.length>2||result.classification!=="STATIC_INTEGRITY_ONLY"){
 console.error("P214_BLOCK=INVALID_OR_DRIFTED_REVIEW_PACKET");process.exitCode=1;
}else{
 process.stdout.write(markdown(result));
 console.log("P214_G02_STATIC_REVIEW_PACKET=PASS");
 console.log("P214_G02=NO_GO_RELEASE");
}
