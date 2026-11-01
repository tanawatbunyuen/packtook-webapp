"use strict";
// PACKTOOK V6.2.3 — Provision a brand NEW internal test wallet, never convert customer credits.
// Production only, Cloud Shell with Firebase Admin credentials. No Omise or payment records.
const admin=require("firebase-admin");
const readline=require("node:readline/promises");
const PROJECT="packtook-prod-01",INITIAL_CREDITS=50;
const [uid,emailArg]=process.argv.slice(2);
if(process.env.GOOGLE_CLOUD_PROJECT!==PROJECT || !uid || !emailArg ||
   !/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailArg) ||
   !/packtook[._+-]?test/i.test(emailArg.split("@")[0])){
 console.error("Usage: GOOGLE_CLOUD_PROJECT=packtook-prod-01 node owner-functions/scripts/provision-beta-wallet-test.js AUTH_UID test+packtooktest@your-domain.com");
 console.error("For safety, email local-part must contain packtooktest / packtook.test and be a verified NEW test account.");
 process.exit(2);
}
admin.initializeApp({projectId:PROJECT});
const auth=admin.auth(),db=admin.firestore();
const {FieldValue}=admin.firestore;
(async()=>{
 const user=await auth.getUser(uid);
 const email=emailArg.trim().toLowerCase();
 if(user.disabled||!user.emailVerified||!user.email||user.email.toLowerCase()!==email)
  throw Error("Auth user must be verified, active, and match the exact email");
 if(user.customClaims?.packtookProductionBeta!==true||
    user.customClaims?.packtookPlatformOwner===true||
    user.customClaims?.packtookOwnerManager===true)
  throw Error("User must have Production Beta permission but NOT Owner or Manager permission");
 // Signing in to verify an email is allowed, but no recordings or billing data may exist.
 const account=db.collection("accounts").doc(uid);
 // Check usage/billing subcollections too: a Firebase account may have no parent doc yet.
 const subcollections=["recordings","billingRequests","ownerChanges","barcodeLocks","duplicateRequests","duplicateApprovals"];
 for(const name of subcollections){
  const one=await account.collection(name).limit(1).get();
  if(!one.empty)throw Error("Existing "+name+" data found; refusing to touch this account");
 }
 const created=Date.parse(user.metadata?.creationTime||"");
 if(!Number.isFinite(created)||created<Date.now()-7*86400000)
  throw Error("This fixture requires an Auth account created within the last 7 days.");
 const now=Date.now(),expiry=new Date(now+30*86400000).toISOString();
 const yearMonth=new Date(now).toISOString().slice(0,7);
 const data={
  plan:"Starter",period:yearMonth,used:0,reserved:0,createdAt:FieldValue.serverTimestamp(),
  updatedAt:FieldValue.serverTimestamp(),planExpiresAt:expiry,
  creditWalletV1:true,creditWalletRemaining:INITIAL_CREDITS,walletStartingCredits:INITIAL_CREDITS,
  internalTestOnly:true,testPurpose:"owner_management_regression",testProvisionedAt:FieldValue.serverTimestamp()
 };
 const confirm="CREATE-PROD-TEST-WALLET-"+uid;
 console.log("Target:",email,"UID:",uid,"Project:",PROJECT);
 console.log("Will provision only accounts/"+uid+" with Starter, 50 wallet credits, 30-day expiry and internalTestOnly flag.");
 console.log("No Omise payment or paid billingRequest will be created.");
 process.stdout.write("Type "+confirm+" to create this TEST account: ");
 const rl=readline.createInterface({input:process.stdin,output:process.stdout});
 let typed;
 try{typed=(await rl.question("")).trim()}finally{rl.close()}
 if(typed!==confirm)throw Error("Cancelled: exact confirmation not received");
 await db.runTransaction(async tx=>{
  const snap=await tx.get(account);
  // A brand new beta user may have created a pristine Free record during sign-in.
  // Permit only that zero-usage record; never touch a customer with orders, reservations,
  // billing or a credit wallet.
  if(snap.exists){
   const existing=snap.data();
   if(existing.plan!=="Free"||existing.creditWalletV1===true||
      existing.used!==0||existing.reserved!==0||existing.openBillingRequestId||
      (existing.devices&&existing.devices.length))
    throw Error("Account has activity or special fields. Refusing test-wallet conversion.");
   tx.update(account,{...data,createdAt:existing.createdAt||FieldValue.serverTimestamp()});
  }else tx.create(account,data);
  tx.create(account.collection("audit").doc("initial_test_wallet"),{
   action:"provision_internal_test_wallet",credits:INITIAL_CREDITS,plan:"Starter",targetEmail:email,
   reason:"Isolated Owner Customer Management functional test",createdAt:FieldValue.serverTimestamp()
  });
 });
 console.log("PASS: New Production internal test wallet provisioned.");
 console.log("Initial wallet: "+INITIAL_CREDITS+" credits; paid expiry:",expiry);
 console.log("Log in to Customer App with this test account, then test Owner credit grants. This is NOT a paid customer.");
})().catch(e=>{console.error("FAILED:",e.message);process.exitCode=1});
