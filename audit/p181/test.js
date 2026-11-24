"use strict";
const assert=require("node:assert/strict");
const {initializeTestEnvironment,assertFails,assertSucceeds}=require("@firebase/rules-unit-testing");
const {doc,collection,getDoc,getDocs,setDoc,updateDoc,deleteDoc,addDoc}=require("firebase/firestore");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
if(process.env.GCLOUD_PROJECT!=="demo-packtook-g01-p181"||
 process.env.GOOGLE_CLOUD_PROJECT!=="demo-packtook-g01-p181"||
 process.env.FIRESTORE_EMULATOR_HOST!=="127.0.0.1:18091")
 throw Error("P181_LOCAL_DEMO_ONLY_GUARD");
const rules=fs.readFileSync(path.resolve(__dirname,"../../firestore.rules"),"utf8");
const hash=crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+Buffer.byteLength(rules)+"\0"),Buffer.from(rules)])).digest("hex");
assert.equal(hash,"52e207280059e5700da77add9e4af45971c94557","Unexpected root rules source");
(async()=>{
 const env=await initializeTestEnvironment({projectId:"demo-packtook-g01-p181",
  firestore:{host:"127.0.0.1",port:18091,rules}});
 let n=0;
 const test=async(label,fn)=>{await fn();n++;console.log("P181_"+label+"=PASS");};
 try{
  await env.withSecurityRulesDisabled(async c=>{
   const db=c.firestore();
   const {setDoc}=require("firebase/firestore");
   await setDoc(doc(db,"accounts","alice"),{plan:"Free"});
   await setDoc(doc(db,"accounts","bob"),{plan:"Free"});
   await setDoc(doc(db,"accounts","alice","recordings","rec001"),{status:"completed"});
   await setDoc(doc(db,"accounts","alice","audit","evt001"),{action:"reserve"});
   await setDoc(doc(db,"accounts","bob","recordings","rec001"),{status:"completed"});
  });
  const a=env.authenticatedContext("alice").firestore();
  const b=env.authenticatedContext("bob").firestore();
  const ownerClaim=env.authenticatedContext("bob",{admin:true,platformOwner:true}).firestore();
  const guest=env.unauthenticatedContext().firestore();
  await test("OWNER_ACCOUNT_READ",()=>assertSucceeds(getDoc(doc(a,"accounts","alice"))));
  await test("OWNER_RECORDING_READ",()=>assertSucceeds(getDoc(doc(a,"accounts","alice","recordings","rec001"))));
  await test("OWNER_AUDIT_READ",()=>assertSucceeds(getDoc(doc(a,"accounts","alice","audit","evt001"))));
  await test("OWNER_RECORDING_LIST",()=>assertSucceeds(getDocs(collection(a,"accounts","alice","recordings"))));
  await test("CROSS_ACCOUNT_READ_DENY",()=>assertFails(getDoc(doc(b,"accounts","alice"))));
  await test("CROSS_RECORDING_READ_DENY",()=>assertFails(getDoc(doc(b,"accounts","alice","recordings","rec001"))));
  await test("CROSS_AUDIT_READ_DENY",()=>assertFails(getDoc(doc(b,"accounts","alice","audit","evt001"))));
  await test("GUEST_ACCOUNT_READ_DENY",()=>assertFails(getDoc(doc(guest,"accounts","alice"))));
  await test("GUEST_RECORDING_READ_DENY",()=>assertFails(getDoc(doc(guest,"accounts","alice","recordings","rec001"))));
  await test("ACCOUNT_ROOT_LIST_DENY",()=>assertFails(getDocs(collection(a,"accounts"))));
  await test("OWNER_ACCOUNT_UPDATE_DENY",()=>assertFails(updateDoc(doc(a,"accounts","alice"),{plan:"Pro"})));
  await test("OWNER_ACCOUNT_DELETE_DENY",()=>assertFails(deleteDoc(doc(a,"accounts","alice"))));
  await test("OWNER_RECORDING_CREATE_DENY",()=>assertFails(setDoc(doc(a,"accounts","alice","recordings","rec002"),{status:"reserved"})));
  await test("OWNER_AUDIT_DELETE_DENY",()=>assertFails(deleteDoc(doc(a,"accounts","alice","audit","evt001"))));
  await test("CUSTOM_CLAIMS_CANNOT_OVERRIDE_TENANT_READ",()=>assertFails(getDoc(doc(ownerClaim,"accounts","alice"))));
  await test("CUSTOM_CLAIMS_CANNOT_OVERRIDE_WRITE_DENIAL",()=>assertFails(setDoc(doc(ownerClaim,"accounts","bob"),{plan:"Pro"})));
  await test("UNKNOWN_TOP_LEVEL_COLLECTION_DENY",()=>assertFails(getDoc(doc(a,"secrets","private"))));
  console.log("P181_G01_EXACT_ROOT_RULES_EMULATOR="+n+"/"+n+"_PASS");
  console.log("P181_ROOT_RULES_BLOB="+hash);
  console.log("P181_G01_GATE=NO_GO_PENDING_RELEASE_REVIEW_AND_CLOUD_ATTESTATION");
  console.log("P181_NO_PROD_WRITES_NO_DEPLOY=PASS");
 }finally{await env.cleanup();}
})().catch(e=>{console.error("P181_G01_FAILED",e);process.exitCode=1;});
