// PACKTOOK V7.0 — pure, OFFLINE emulator safety guard.
// Never print environment VALUES: Cloud Shell may carry sensitive context.
// Project identifier + BOTH local emulator endpoints must be exact.
const DEMO="demo-packtook-v70";
const PROD="packtook-prod-01";
const loopback=(value,port)=>new RegExp("^(?:127\\.0\\.0\\.1|localhost|\\[::1\\]):"+port+"$").test(value||"");
export function assertV70DemoEnvironment(env){
 if(env.PACKTOOK_QA_DEMO_PROJECT!==DEMO)
  throw Error("SAFETY BLOCK [DEMO_PROJECT]: expected explicit demo-packtook-v70 marker");
 if(!loopback(env.FIREBASE_AUTH_EMULATOR_HOST,9099))
  throw Error("SAFETY BLOCK [AUTH_EMULATOR_HOST]: expected localhost/127.0.0.1/[::1] on port 9099");
 if(!loopback(env.FIRESTORE_EMULATOR_HOST,8080))
  throw Error("SAFETY BLOCK [FIRESTORE_EMULATOR_HOST]: expected localhost/127.0.0.1/[::1] on port 8080");
 for(const key of ["GCLOUD_PROJECT","GCP_PROJECT","GOOGLE_CLOUD_PROJECT","FIREBASE_PROJECT_ID"]){
  if(env[key]===PROD)
   throw Error("SAFETY BLOCK ["+key+"]: Production project context detected. Do not bypass the guard.");
 }
 return true;
}
