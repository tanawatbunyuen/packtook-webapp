// PACKTOOK V7.2 — browser source mutation checks, no cloud or real browser.
import assert from "node:assert/strict";
import fs from "node:fs";
import {assessPilotBrowserSource,collectBrowserSource} from "./v72-pilot-browser-source-check.mjs";
const base=collectBrowserSource();
const inspect=delta=>assessPilotBrowserSource({...base,...delta});
const good=inspect({});
assert.equal(good.sourcePass,true,JSON.stringify(good.checks));
assert.equal(good.decision,"NO_GO_CONTROLLED_PILOT");
assert.equal(good.realBrowserAttestationVerified,false);
assert.equal(good.productionDeployed,false);
const mut=(name,changes,check)=>{
 const result=inspect(changes);
 assert.equal(result.sourcePass,false,"Unsafe browser mutation must be rejected: "+name);
 assert.equal(result.checks[check],false,"Expected failing gate "+check+" for "+name);
};
mut("visible public marketing route",{marketing:base.marketing+'<a href="pilot-free.html">Free Pilot</a>'},"unlinkedFromPublic");
mut("visible customer route",{customer:base.customer+'<a href="pilot-free.html">Join</a>'},"unlinkedFromPublic");
mut("Firebase Auth register",{
 js:base.js+'createUserWithEmailAndPassword(auth,email,password);'
},"noPublicAuthCreation");
mut("no App Check",{
 js:base.js.replace("isTokenAutoRefreshEnabled:true","isTokenAutoRefreshEnabled:false")
},"appCheckAndProjectScope");
mut("no server invite",{
 js:base.js.replaceAll('call("pilotInvitationStatus")','call("unsafeOpenPilot")')
},"signedInServerInvitation");
mut("no verification",{
 js:base.js.replace("sendEmailVerification(currentUser)","/* removed */")
},"verifiedEmailAndBothConsents");
mut("missing privacy consent",{
 js:base.js.replace("acceptTestTerms:true,acceptPrivacy:true","acceptTestTerms:true")
},"verifiedEmailAndBothConsents");
mut("public complete Free mistaken",{
 js:base.js.replace('call("completePilotFreeSignup")','call("completeFreeSignup")')
},"noPublicAuthCreation");
mut("bridge Pilot claim trusted",{
 bridge:base.bridge.replace('user=(await pilotAvailability()).active===true?u:null','user=u')
},"liveBridgeForPacking");
mut("Firebase callable no token binding",{
 backend:base.backend.replace("requirePilotLease(req,{allowUnverified:true})","requirePilotLease(req)")
},"signedInServerInvitation");
mut("indexable route",{
 html:base.html.replace('name="robots" content="noindex,nofollow,noarchive"',
 'name="robots" content="index,follow"')
},"invitationOnlyNoindex");
console.log("PASS: invitation-only page source and live PACKING Pilot bridge contract");
console.log("PASS: visible CTA, public Auth signup, no App Check, missing verification/consent and stale claim rejected");
console.log("PASS: no backend/Firestore writes or real browser App Check claims from source tests");
console.log("RESULT: PACKTOOK V7.2 PILOT BROWSER SOURCE SAFETY PASS (offline NO-GO)");
