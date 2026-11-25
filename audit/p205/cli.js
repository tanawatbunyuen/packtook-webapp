"use strict";
const fs=require("node:fs"),path=require("node:path");
const {dashboard,renderMarkdown}=require("./dashboard");
try{
 if(process.argv.length>3)throw Error("P205_USAGE");
 const file=process.argv[2];
 let data={};
 if(file){
  if(process.env.CI==="true"||process.env.GITHUB_ACTIONS==="true")
   throw Error("P205_CI_EXTERNAL_EVIDENCE_DENIED");
  const pathname=path.resolve(file),stat=fs.lstatSync(pathname);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32768)
   throw Error("P205_UNTRUSTED_OR_OVERSIZE_INPUT");
  data=JSON.parse(fs.readFileSync(pathname,"utf8"));
  if(!data||typeof data!=="object"||Array.isArray(data)||
      Object.keys(data).some(k=>!["submissions","claims","asOf"].includes(k)))
   throw Error("P205_UNKNOWN_TOP_LEVEL_FIELDS");
 }
 const result=dashboard(data);
 process.stdout.write(renderMarkdown(result));
}catch(e){
 const safe=typeof e.message==="string"&&e.message.startsWith("P205_")?e.message:"P205_INVALID_INPUT_REDACTED";
 process.stderr.write("P205_BLOCK="+safe+"\n");process.exitCode=1;
}
