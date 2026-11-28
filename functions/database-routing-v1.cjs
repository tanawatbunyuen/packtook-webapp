"use strict";

const {
 getFirestore
}=require("firebase-admin/firestore");

const DEMO="demo-packtook-integrated-01";
const STAGING="packtook-staging";
const NAMED="g02-security-test";

function resolveDatabase({
 projectId,
 mode,
 databaseId,
 emulatorHost
}){

 const local=/^127\.0\.0\.1:\d+$/
  .test(emulatorHost||"");

 if(
  projectId===DEMO &&
  mode==="local-demo" &&
  databaseId==="(default)" &&
  local
 ){
  return "(default)";
 }

 if(
  projectId===STAGING &&
  mode==="isolated-staging" &&
  databaseId===NAMED &&
  !emulatorHost
 ){
  return NAMED;
 }

 throw new Error(
  "PACKTOOK_DATABASE_ROUTE_DENIED"
 );
}

function createDatabase(app,config){

 const id=resolveDatabase(config);

 if(id==="(default)"){
  return getFirestore(app);
 }

 return getFirestore(app,id);
}

module.exports={
 resolveDatabase,
 createDatabase
};
