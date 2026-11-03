// PACKTOOK V7.2 invite-only browser static safety assessor (read-only).
// Source checks do not prove real signed App Check tokens or Browser runtime.
import fs from "node:fs";
export function assessPilotBrowserSource({html,js,bridge,backend,marketing,customer,firebase}){
 const has=(text,needle)=>typeof text==="string"&&text.includes(needle);
 const htmlIds=["loginForm","memberPanel","identity","inviteState","expiry",
  "sendVerify","refresh","acceptTerms","acceptPrivacy","activate",
  "enterPacking","logout","status"];
 const checks={
  invitationOnlyNoindex:has(html,'name="robots" content="noindex,nofollow,noarchive"')&&
   has(html,'src="./pilot-free.js?v=7.2.0"')&&
   htmlIds.every(id=>has(html,'id="'+id+'"')),
  unlinkedFromPublic:!has(marketing,"pilot-free.html")&&
   !has(customer,"pilot-free.html"),
  noPublicAuthCreation:!has(js,"createUserWithEmailAndPassword")&&
   !has(js,'call("completeFreeSignup")')&&
   !has(js,'call("publicSignupStatus")')&&
   !has(js,'call("completeQaFreeSignup")'),
  appCheckAndProjectScope:has(js,'const PROJECT="packtook-prod-01"')&&
   has(js,"new ReCaptchaEnterpriseProvider(")&&
   has(js,"isTokenAutoRefreshEnabled:true")&&
   has(js,'getFunctions(app,"asia-southeast1")'),
  signedInServerInvitation:has(js,"onAuthStateChanged(")&&
   has(js,'call("pilotInvitationStatus")')&&
   has(backend,"req.app?.appId!==PUBLIC_CUSTOMER_APP_ID")&&
   has(backend,"requirePilotLease(req,{allowUnverified:true})"),
  verifiedEmailAndBothConsents:has(js,"sendEmailVerification(currentUser)")&&
   has(js,"reload(currentUser)")&&
   has(js,'el("acceptTerms").checked')&&
   has(js,'el("acceptPrivacy").checked')&&
   has(js,"acceptTestTerms:true,acceptPrivacy:true"),
  exactSeparateActivation:has(js,'call("completePilotFreeSignup")')&&
   has(backend,"exports.completePilotFreeSignup=onCall({...options,enforceAppCheck:true,")&&
   has(js,"getIdTokenResult(true)")&&
   has(js,'location.assign("./index.html")'),
  liveBridgeForPacking:has(bridge,'async function pilotAvailability()')&&
   has(bridge,'api("pilotInvitationStatus")')&&
   has(bridge,"value?.active===true")&&
   has(bridge,'user=(await pilotAvailability()).active===true?u:null')&&
   has(bridge,'token.claims.packtookPilotV72===true'),
  noClientFirestoreControl:!has(js,"firebase-firestore")&&
   !has(js,"setDoc(")&&!has(js,"pilotControls/v72")&&
   !has(js,"PACKTOOK_V72_PILOT_ENABLED"),
  safeHostedRoute:firebase?.hosting?.some(item=>item.target==="app"&&
   item.headers?.some(row=>row.headers?.some(h=>
    h.key==="X-Robots-Tag"&&h.value==="noindex, nofollow"))),
  noLiveOrSecretMaterial:!/(?:skey_live_|PACKTOOK_OMISE_TEST_SECRET_KEY|HMAC_KEY_HEX)/.test(js+html)
 };
 return {sourcePass:Object.values(checks).every(Boolean),checks,
  realBrowserAttestationVerified:false,productionDeployed:false,
  decision:"NO_GO_CONTROLLED_PILOT"};
}
export function collectBrowserSource(){
 const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
 return {html:read("app/pilot-free.html"),js:read("app/pilot-free.js"),
  bridge:read("app/firebase-packing-bridge.js"),backend:read("functions/index.js"),
  marketing:read("public/index.html"),customer:read("app/index.html"),
  firebase:JSON.parse(read("firebase.json"))};
}
const isMain=process.argv[1]&&process.argv[1].endsWith("/v72-pilot-browser-source-check.mjs");
if(isMain){
 const report=assessPilotBrowserSource(collectBrowserSource());
 console.log(JSON.stringify(report,null,2));
 if(!report.sourcePass)process.exitCode=2;
}
