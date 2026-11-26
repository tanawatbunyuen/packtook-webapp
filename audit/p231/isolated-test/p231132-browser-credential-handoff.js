// P231.132 — Run only on trusted https://packtook-staging.web.app in Chrome/Edge.
// Produces one short-lived credential bundle in the LOCAL clipboard (NEVER Console).
// Clipboard contains sensitive live bearer credentials. Paste ONLY into the masked
// P231.132 Cloud Shell runner on a private machine; never into chat, GitHub, or logs.
(async () => {
  const report=(k,v)=>console.log("P231_"+k+"="+v);
  report("CHECK","CONTROLLED_E2E_STAGING_BROWSER_CREDENTIAL_HANDOFF");
  report("SCRIPT_VERSION","P231137_USER_GESTURE_CLIPBOARD_V4");
  let tempApp=null;
  let stage="START";
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
    stage="LOAD_SDK_AND_CONFIG";
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
    stage="FIREBASE_AUTH_STATE";
    const auth=authSdk.getAuth(existing);
    if(typeof auth.authStateReady==="function") await auth.authStateReady();
    const user=auth.currentUser;
    if(!user||user.emailVerified!==true){
      report("GATE","BLOCKED_TEST_USER_NOT_VERIFIED");return;
    }
    // Operator confirmed this logged-in staging user is a test-only account.
    stage="READ_HOSTED_BRIDGE";
    const res=await fetch("/firebase-packing-bridge.js",{
      method:"GET",credentials:"omit",cache:"no-store",redirect:"error"
    });
    if(!res.ok){report("GATE","BLOCKED_HOSTED_BRIDGE");return;}
    const bridge=await res.text();
    const m=bridge.match(/\bnew\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)/);
    if(!m?.[2]){report("GATE","BLOCKED_SITE_KEY_SOURCE");return;}
    stage="INITIALIZE_TEMP_APPCHECK";
    tempApp=apps.initializeApp(config.firebaseConfig,"p231-e2e-"+crypto.randomUUID());
    const check=appCheckSdk.initializeAppCheck(tempApp,{
      provider:new appCheckSdk.ReCaptchaEnterpriseProvider(m[2]),
      isTokenAutoRefreshEnabled:false
    });
    // Both tokens stay only in local JS memory, then are placed in clipboard.
    stage="ISSUE_AUTH_AND_APPCHECK_TOKENS";
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
    // Clipboard writes need transient user activation in Chrome/Edge. Do NOT
    // await Firebase calls before initiating writeText inside the click handler.
    // Credential contents are held ONLY in this closure, NEVER put into DOM.
    stage="WAITING_FOR_USER_GESTURE";
    const id="p231137-copy-staging-test-credentials";
    document.getElementById(id)?.remove();
    const btn=document.createElement("button");
    btn.id=id;
    btn.textContent="P231: Copy staging test credentials (60s)";
    btn.setAttribute("type","button");
    btn.setAttribute("aria-label","Copy sensitive staging test credentials to clipboard");
    Object.assign(btn.style,{
      position:"fixed",top:"16px",right:"16px",zIndex:"2147483647",
      background:"#173b54",color:"#ffffff",padding:"12px 16px",
      border:"2px solid #fff",borderRadius:"8px",cursor:"pointer",
      font:"600 13px sans-serif",boxShadow:"0 2px 12px #0005"
    });
    const created=Date.now();
    const activeDate=()=>{
      const d=Object.fromEntries(new Intl.DateTimeFormat("en-US",{
        timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"
      }).formatToParts(new Date()).filter(x=>x.type!=="literal").map(x=>[x.type,x.value]));
      return `${d.year}-${d.month}-${d.day}`==="2026-11-26";
    };
    let timer;
    const cleanup=()=>{clearTimeout(timer);btn.remove();};
    btn.addEventListener("click",()=>{
      // Validate synchronously BEFORE the privileged clipboard call.
      if(Date.now()-created>60000||!activeDate()||
         location.origin!=="https://packtook-staging.web.app"||
         self.FIREBASE_APPCHECK_DEBUG_TOKEN!==undefined){
        report("COPY_GATE","BLOCKED_EXPIRED_OR_CONTEXT_CHANGED");
        cleanup();return;
      }
      btn.disabled=true;
      stage="CLIPBOARD_WRITE_USER_GESTURE";
      // This call must be the first async operation in the click event.
      navigator.clipboard.writeText(bundle).then(async()=>{
        report("BUNDLE","COPIED_TO_LOCAL_CLIPBOARD_SENSITIVE");
        try{
          const pasted=await navigator.clipboard.readText();
          const result=JSON.parse(pasted);
          report("CLIPBOARD_READBACK",
            result?.firebaseAuthToken===firebaseAuthToken&&
            result?.appCheckToken===appCheckToken
            ?"VALID_JSON_MATCH":"MISMATCH_DO_NOT_PASTE");
        }catch{report("CLIPBOARD_READBACK","NOT_VERIFIED_BROWSER_PERMISSION");}
        report("NEXT","PASTE_ONCE_IN_MASKED_CLOUD_SHELL_PROMPT");
        cleanup();
      }).catch(e=>{
        const safeName=["NotAllowedError","NotFoundError","NotSupportedError",
          "SecurityError","AbortError","TypeError"].includes(e?.name)
          ?e.name:"REDACTED";
        report("FAILED_STAGE","CLIPBOARD_WRITE_USER_GESTURE");
        report("ERROR_CLASS",safeName);
        report("GATE","BLOCKED_BROWSER_CLIPBOARD_PERMISSION");
        cleanup();
      });
    },{once:true});
    document.body.appendChild(btn);
    timer=setTimeout(()=>{report("COPY_GATE","EXPIRED_60_SECONDS");cleanup();},60000);
    report("BROWSER_COPY_BUTTON","READY_CLICK_WITHIN_60_SECONDS");
    report("FIREBASE_AUTH_ID_TOKEN","PRESENT_NOT_PRINTED");
    report("APPCHECK_TOKEN","PRESENT_NOT_PRINTED");
  }catch(e){
    report("FAILED_STAGE",stage);
    const safeName=["NotAllowedError","NotFoundError","NotSupportedError","SecurityError","AbortError","TypeError"].includes(e?.name)?e.name:"REDACTED";
    report("ERROR_CLASS",safeName);
    report("GATE","BLOCKED_BROWSER_OR_CLIPBOARD_ERROR");
  }finally{
    if(tempApp)try{await (await import("https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js")).deleteApp(tempApp);}catch{}
    report("TOKENS_IN_CONSOLE","NONE");
    report("CALLABLE_INVOKE","NOT_PERFORMED");
    report("RELEASE","NO_GO");
  }
})();
