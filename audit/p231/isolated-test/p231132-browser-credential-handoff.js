// P231.132 — Run only on trusted https://packtook-staging.web.app in Chrome/Edge.
// Produces one short-lived credential bundle in the LOCAL clipboard (NEVER Console).
// Clipboard contains sensitive live bearer credentials. Paste ONLY into the masked
// P231.132 Cloud Shell runner on a private machine; never into chat, GitHub, or logs.
(async () => {
  const report=(k,v)=>console.log("P231_"+k+"="+v);
  report("CHECK","CONTROLLED_E2E_STAGING_BROWSER_CREDENTIAL_HANDOFF");
  report("SCRIPT_VERSION","P231134_CLIPBOARD_READBACK_V2");
  let tempApp=null;
  try{
    if(location.origin!=="https://packtook-staging.web.app"){
      report("GATE","BLOCKED_WRONG_ORIGIN");return;
    }
    const dates=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
      timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"
    }).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
    if(`${dates.year}-${dates.month}-${dates.day}`!=="2026-11-26"){
      report("GATE","BLOCKED_APPROVED_TEST_DATE");return;
    }
    if(self.FIREBASE_APPCHECK_DEBUG_TOKEN!==undefined){
      report("GATE","BLOCKED_DEBUG_TOKEN");return;
    }
    const sdk="https://www.gstatic.com/firebasejs/11.10.0/";
    const [apps,authSdk,appCheckSdk,config]=await Promise.all([
      import(sdk+"firebase-app.js"),
      import(sdk+"firebase-auth.js"),
      import(sdk+"firebase-app-check.js"),
      import("/firebase-v4-config.js")
    ]);
    if(config.firebaseConfig?.projectId!=="packtook-staging"){
      report("GATE","BLOCKED_PROJECT");return;
    }
    const existing=apps.getApps().find(a=>a.name==="[DEFAULT]"&&a.options?.projectId==="packtook-staging");
    if(!existing){report("GATE","BLOCKED_NO_DEFAULT_STAGING_APP");return;}
    const auth=authSdk.getAuth(existing);
    if(typeof auth.authStateReady==="function") await auth.authStateReady();
    const user=auth.currentUser;
    if(!user||user.emailVerified!==true){
      report("GATE","BLOCKED_TEST_USER_NOT_VERIFIED");return;
    }
    // Operator confirmed this logged-in staging user is a test-only account.
    const res=await fetch("/firebase-packing-bridge.js",{
      method:"GET",credentials:"omit",cache:"no-store",redirect:"error"
    });
    if(!res.ok){report("GATE","BLOCKED_HOSTED_BRIDGE");return;}
    const bridge=await res.text();
    const m=bridge.match(/\bnew\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)/);
    if(!m?.[2]){report("GATE","BLOCKED_SITE_KEY_SOURCE");return;}
    tempApp=apps.initializeApp(config.firebaseConfig,"p231-e2e-"+crypto.randomUUID());
    const check=appCheckSdk.initializeAppCheck(tempApp,{
      provider:new appCheckSdk.ReCaptchaEnterpriseProvider(m[2]),
      isTokenAutoRefreshEnabled:false
    });
    // Both tokens stay only in local JS memory, then are placed in clipboard.
    const [firebaseAuthToken,appcheckResult]=await Promise.all([
      authSdk.getIdToken(user,false),
      appCheckSdk.getToken(check,true)
    ]);
    const appCheckToken=appcheckResult?.token;
    if(typeof firebaseAuthToken!=="string"||!firebaseAuthToken||
       typeof appCheckToken!=="string"||!appCheckToken){
      report("GATE","BLOCKED_TOKEN_UNAVAILABLE");return;
    }
    const bundle=JSON.stringify({firebaseAuthToken,appCheckToken});
    // No token values appear in Console, browser URLs or any outgoing custom request.
    await navigator.clipboard.writeText(bundle);
    report("BUNDLE","COPIED_TO_LOCAL_CLIPBOARD_SENSITIVE");
    // Read back for structural validation WITHOUT ever printing clipboard contents.
    try {
      const pasted=await navigator.clipboard.readText();
      const roundtrip=JSON.parse(pasted);
      if(typeof roundtrip?.firebaseAuthToken!=="string"||
         typeof roundtrip?.appCheckToken!=="string"||
         roundtrip.firebaseAuthToken!==firebaseAuthToken||
         roundtrip.appCheckToken!==appCheckToken){
        report("CLIPBOARD_READBACK","MISMATCH_DO_NOT_PASTE");return;
      }
      report("CLIPBOARD_READBACK","VALID_JSON_MATCH");
    }catch{
      report("CLIPBOARD_READBACK","NOT_VERIFIED_BROWSER_PERMISSION");
    }
    report("FIREBASE_AUTH_ID_TOKEN","PRESENT_NOT_PRINTED");
    report("APPCHECK_TOKEN","PRESENT_NOT_PRINTED");
    report("NEXT","PASTE_ONCE_IN_MASKED_CLOUD_SHELL_PROMPT");
  }catch{
    report("GATE","BLOCKED_BROWSER_OR_CLIPBOARD_ERROR");
  }finally{
    if(tempApp)try{await (await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js")).deleteApp(tempApp);}catch{}
    report("TOKENS_IN_CONSOLE","NONE");
    report("CALLABLE_INVOKE","NOT_PERFORMED");
    report("RELEASE","NO_GO");
  }
})();
