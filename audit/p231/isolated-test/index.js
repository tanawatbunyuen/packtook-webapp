'use strict';

// P231 isolated read-only callable. NEVER add to live functions/index.js.
const {onCall,HttpsError}=require('firebase-functions/v2/https');

exports.p231AppCheckIsolatedProbe=onCall({
  region:'asia-southeast1',
  invoker:'private',
  serviceAccount:'p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com',
  enforceAppCheck:true,
  maxInstances:1,
  concurrency:1,
  timeoutSeconds:10,
  memory:'256MiB'
},async request=>{
  // Defense in depth: callable wrapper must verify Auth and App Check before entry.
  if(!request.app?.appId){
    throw new HttpsError('failed-precondition','App Check context required');
  }
  if(!request.auth?.uid||request.auth.token?.email_verified!==true){
    throw new HttpsError('unauthenticated','Verified staging user required');
  }
  if(request.data==null||typeof request.data!=='object'||
     Array.isArray(request.data)||Object.keys(request.data).length!==0){
    throw new HttpsError('invalid-argument','Empty data object required');
  }
  return Object.freeze({probe:'p231-isolated',result:'PASS'});
});
