// P231.128 — Inspect existing staging browser Firebase Auth state; NO login, NO token retrieval.
// Paste ONLY on https://packtook-staging.web.app; report no user identifiers.
(async () => {
  const emit=(k,v)=>console.log("P231_"+k+"="+v);
  emit("CHECK","STAGING_BROWSER_AUTH_STATE_READONLY");
  try {
    if(location.origin!=="https://packtook-staging.web.app"){
      emit("GATE","BLOCKED_WRONG_ORIGIN");return;
    }
    const base="https://www.gstatic.com/firebasejs/11.10.0/";
    const [apps,authSdk]=await Promise.all([
      import(base+"firebase-app.js"),import(base+"firebase-auth.js")
    ]);
    const staging=apps.getApps().filter(a=>a.options?.projectId==="packtook-staging");
    // Do not create or sign into an app as an implicit side-effect.
    emit("EXISTING_STAGING_FIREBASE_APPS",staging.length?"PRESENT":"NONE");
    if(!staging.length){emit("AUTH_STATE","UNAVAILABLE_NO_INITIALIZED_STAGING_APP");return;}
    const app=staging.find(a=>a.name==="[DEFAULT]")||staging[0];
    const auth=authSdk.getAuth(app);
    if(typeof auth.authStateReady==="function")await auth.authStateReady();
    const user=auth.currentUser;
    emit("AUTH_USER_PRESENT",user?"YES":"NO");
    emit("AUTH_EMAIL_VERIFIED",user?.emailVerified===true?"YES":user?"NO":"NOT_APPLICABLE");
    emit("SYNTHETIC_TEST_IDENTITY","NOT_ATTESTED_BY_THIS_PROBE");
    emit("AUTH_ID_TOKEN","NOT_READ");
  }catch {
    emit("AUTH_STATE","INCONCLUSIVE");
  }finally {
    emit("APP_CHECK_TOKEN_VALUE","NOT_READ");
    emit("CLOUD_RUN_FUNCTION_INVOKE","NOT_PERFORMED");
    emit("RUNTIME_E2E","NOT_PERFORMED");
    emit("IAM_WRITES","0");
    emit("DEPLOY","NOT_PERFORMED");
    emit("CLEANUP","NOT_PERFORMED");
    emit("RELEASE","NO_GO");
  }
})();
