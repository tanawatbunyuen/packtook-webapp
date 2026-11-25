"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const old=fs.readFileSync(path.resolve(__dirname,"../p226/probe/index.js"),"utf8");
const src=fs.readFileSync(path.join(__dirname,"probe/index.js"),"utf8");
const before='const COL="__g02_iam_boundary_probe__";';
const after='const COL="g02_iam_boundary_probe";';
const cases=[
["exact-one-line-source",()=>assert.equal(src,old.replace(before,after))],
["original-has-invalid-id",()=>assert(old.includes(before))],
["fixed-id-present",()=>assert(src.includes(after))],
["old-id-removed",()=>assert(!src.includes(before))],
["reserved-old",()=>assert(/^__.*__$/.test("__g02_iam_boundary_probe__"))],
["valid-new",()=>assert(!/^__.*__$/.test("g02_iam_boundary_probe"))],
["private-only",()=>assert(src.includes('invoker:"private"'))],
["project-staging",()=>assert(src.includes('const PROJECT="packtook-staging"'))],
["named-db",()=>assert(src.includes('const NAMED="g02-security-test"'))],
["default-db",()=>assert(src.includes('const DEFAULT="(default)"'))],
["no-user-path",()=>assert(!/req\.(?:body|query|params)/.test(src))],
["no-write",()=>assert(!/(?:dbNamed|dbDefault|db|snap)\.(?:set|update|delete|create|add|runTransaction)\(/.test(src))],
["fail-closed",()=>assert(src.includes("passed?200:503"))],
["must-deny-default",()=>assert(src.includes('defaultRest.code==="PERMISSION_DENIED"'))],
["no-go",()=>assert(src.includes('release:"NO_GO"'))]
];
for(const [name,run] of cases){run();console.log("P227_"+name+"=PASS")}
console.log("P227_OFFLINE_FIXTURES="+cases.length+"/"+cases.length+"_PASS");
console.log("P227_DEPLOYED=FALSE G02=NO_GO");
