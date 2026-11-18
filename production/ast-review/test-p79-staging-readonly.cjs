"use strict";
/* P79 test runner can only exercise offline Python unittest mocks. */
const {test}=require("node:test"),assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const script="production/scripts/test-p79-staging-revision-readonly.py";
test("P79 offline fixture checks reject drift and never expose metadata",()=>{
 const p=spawnSync("python3",[script],{encoding:"utf8",timeout:8000,
  env:{PATH:process.env.PATH,LANG:"C.UTF-8"}});
 assert.equal(p.status,0,p.stderr);
 assert.match(p.stdout,/P79_OFFLINE_TESTS=PASS/);
});
