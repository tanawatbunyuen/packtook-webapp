"""Real Firebase App Check browser attestation, NO auth/password/personal or production data.
Test intentionally exits nonzero if genuine token acquisition cannot be verified.
DO NOT emit the token or detailed SDK exception messages.
"""
from playwright.sync_api import sync_playwright
ORIGIN="https://packtook-staging.web.app/"
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    ctx=browser.new_context(service_workers="block",ignore_https_errors=False)
    page=ctx.new_page()
    response=page.goto(ORIGIN,wait_until="domcontentloaded",timeout=30000)
    assert response and response.status==200,"staging HTTP not 200"
    page.wait_for_function("window.PACKTOOK_FIREBASE?.ready===true",timeout=25000)
    result=page.evaluate("""async () => {
      try{
        const appSdk=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js');
        const checkSdk=await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js');
        const app=appSdk.getApp();
        if(app.options.projectId!=='packtook-staging')
          return {status:'REJECT',reason:'PROJECT_MISMATCH'};
        const check=checkSdk.getAppCheck(app);
        const receipt=await Promise.race([
          checkSdk.getToken(check,true),
          new Promise(resolve=>setTimeout(()=>resolve({timedOut:true}),20000))
        ]);
        if(receipt?.timedOut)return {status:'BLOCKED',reason:'TOKEN_TIMEOUT'};
        if(typeof receipt?.token!=='string'||receipt.token.length<50)
          return {status:'BLOCKED',reason:'NO_TOKEN'};
        // Token must not be exposed to GitHub logs; only its existence is returned.
        return {status:'PASS',reason:'SDK_RETURNED_TOKEN',fromCache:!!receipt.fromCache};
      }catch(error){
        const code=String(error?.code||'').slice(0,100);
        return {status:'BLOCKED',reason:'SDK_ERROR',code};
      }
    }""")
    assert result['status']=='PASS',f"APP_CHECK_ATTESTATION_{result['status']}: {result['reason']} {result.get('code','')}"
    assert result['reason']=='SDK_RETURNED_TOKEN'
    print("RR_REAL_STAGING_APPCHECK_BROWSER_TOKEN: PASS")
    print("RR_REAL_STAGING_APPCHECK_BACKEND_VERIFICATION: NOT_TESTED")
    print("RR_REAL_STAGING_APPCHECK_CONSUME_REPLAY: NOT_TESTED")
    print("RR_OWNER_LOGIN: NOT_TESTED")
    print("RR_OMISE_TEST_READ: NOT_TESTED")
    print("RR_PRODUCTION_WRITES: 0")
    browser.close()
