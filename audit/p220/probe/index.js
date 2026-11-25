"use strict";
/** P220 independent, read-only, synthetic-account-only G02 probe.
 * NOT the complete P188 backend and NOT independent G02 release signoff.
 * Does not import payment, migration, subscription, owner-backfill or writes.
 */
const {onCall,HttpsError}=require("firebase-functions/v2/https");
const admin=require("firebase-admin");
if(!admin.apps.length)admin.initializeApp();
const {getFirestore}=require("firebase-admin/firestore");
const DATABASE_ID="g02-security-test";
if(DATABASE_ID==="(default)")throw Error("G02_DEFAULT_DATABASE_FORBIDDEN");
const db=getFirestore(admin.app(),DATABASE_ID);
const options={region:"asia-southeast1",enforceAppCheck:true,
 invoker:"private",maxInstances:1,timeoutSeconds:15};
const synthetic=/^g02test_[a-zA-Z0-9_-]{10,60}$/;
const probe=async req=>{
 if(!req.auth||typeof req.auth.uid!=="string")
  throw new HttpsError("unauthenticated","Firebase Auth required");
 if(req.auth.token?.email_verified!==true)
  throw new HttpsError("permission-denied","Verified email required");
 const id=req.auth.uid;
 if(!synthetic.test(id))
  throw new HttpsError("permission-denied","Synthetic G02 test identity required");
 const ref=db.collection("accounts").doc(id),snap=await ref.get();
 if(!snap.exists||snap.data()?.ownerUid!==id)
  throw new HttpsError("permission-denied","Explicit account Owner required");
 return {authorized:true,role:"admin",accountKind:"synthetic-g02-test"};
};
exports.g02AuthzProbe=onCall(options,probe);
