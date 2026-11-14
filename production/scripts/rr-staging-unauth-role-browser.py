"""PACKTOOK Staging unauthenticated read-only security exercise.
No credentials, no login submission, no signup, no payment/credit methods.
Calls ONLY read-only accountRole() and validates failure closed.
"""
from playwright.sync_api import sync_playwright
import re
BASE="https://packtook-staging.web.app/"
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(service_workers="block",ignore_https_errors=False)
    page=context.new_page()
    response=page.goto(BASE,wait_until="domcontentloaded",timeout=30000)
    assert response and response.status==200,"staging unavailable"
    page.wait_for_function("window.PACKTOOK_FIREBASE?.ready===true",timeout=30000)
    print("RR_LIVE_BRIDGE_INITIALIZED: PASS")
    assert page.locator("#loginPage").is_visible(),"unauthenticated login not shown"
    assert page.locator("#appPage").is_hidden(),"protected application visible before login"
    print("RR_OWNER_DASHBOARD_UNAUTH_HIDDEN: PASS")
    result=page.evaluate("""async () => {
        const call=window.PACKTOOK_FIREBASE.accountRole;
        if(typeof call!=='function') return {outcome:'missing'};
        try{
            const v=await Promise.race([call(),new Promise(resolve=>setTimeout(()=>resolve('TIMEOUT'),18000))]);
            if(v==='TIMEOUT')return {outcome:'timeout'};
            return {outcome:'unexpected_success'};
        }catch(error){
            const code=String(error?.code||'').toLowerCase();
            const message=String(error?.message||'').slice(0,200).toLowerCase();
            return {outcome:'rejected',code,authCode:code.includes('unauthenticated')||code.includes('permission-denied'),
                appcheckCode:code.includes('app-check')||message.includes('app check')};
        }
    }""")
    assert result['outcome']=='rejected',f"unsafe or inconclusive callable result: {result['outcome']}"
    if result['authCode']:
        print("RR_UNAUTH_ACCOUNT_ROLE: REJECTED_BY_AUTH")
    elif result['appcheckCode']:
        print("RR_UNAUTH_ACCOUNT_ROLE: REJECTED_BY_APPCHECK")
    else:
        # A rejected read-only call alone doesn't prove auth enforcement; require a recognized code.
        print("RR_UNAUTH_ACCOUNT_ROLE: REJECTED_OTHER_CODE",result['code'][:80])
        raise AssertionError("Backend denial reason unverified; cannot credit auth/App Check gate")
    print("RR_UNAUTH_OWNER_ROLE_NO_DATA: PASS")
    assert page.locator("#appPage").is_hidden()
    print("RR_STAGING_UNAUTH_READONLY_SECURITY: PASS")
    print("RR_ACTUAL_OWNER_LOGIN: NOT_TESTED")
    print("RR_REAL_APPCHECK_REPLAY: NOT_TESTED")
    print("RR_OMISE_PROVIDER_TEST_GET: NOT_TESTED")
    browser.close()
