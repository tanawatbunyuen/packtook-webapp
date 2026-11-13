#!/usr/bin/env python3
"""Live unauthenticated browser smoke; NO login, credentials, signup or writes."""
from playwright.sync_api import sync_playwright
from urllib.request import urlopen, Request
import re, sys
BASE="https://packtook-staging.web.app"
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    ctx=browser.new_context(ignore_https_errors=False,service_workers="block")
    page=ctx.new_page()
    res=page.goto(BASE+"/",wait_until="domcontentloaded",timeout=30000)
    assert res is not None and res.status==200, f"HTML status {None if res is None else res.status}"
    assert "PACKTOOK" in page.title(), "title missing"
    assert page.locator("#loginPage").is_visible(), "login page hidden"
    assert page.locator("#loginForm").is_visible(), "login form missing"
    assert page.locator("#email").get_attribute("type")=="email", "email input type"
    assert page.locator("#password").get_attribute("type")=="password", "password should be masked"
    assert page.locator("#loginForm button[type=submit]").count()>=1, "submit absent"
    print("BROWSER_LIVE_LOGIN_LAYOUT: PASS")
    try:
        page.wait_for_function("window.PACKTOOK_FIREBASE && window.PACKTOOK_FIREBASE.ready===true",
                               timeout=25000)
        print("BROWSER_FIREBASE_BRIDGE_READY: PASS")
    except Exception:
        print("BROWSER_FIREBASE_BRIDGE_READY: NOT_CONFIRMED")
        # Don't misrepresent script-init success, but continue diagnostic checks.
    assert page.locator("#loginPage").is_visible(), "unauthenticated page must remain at login"
    print("BROWSER_UNAUTHENTICATED_ROUTE: PASS")
    bridge=page.request.get(BASE+"/firebase-packing-bridge.js",timeout=20000)
    assert bridge.status==200, f"bridge HTTP {bridge.status}"
    source=bridge.text()
    assert "initializeApp(" in source and "getAuth(" in source
    assert "httpsCallable" in source
    print("LIVE_BRIDGE_FIREBASE_AUTH_AND_FUNCTIONS_IMPORTS: PASS")
    has_appcheck=bool(re.search(r'initializeAppCheck\s*\(|getToken\s*\(|firebase-app-check',source,re.I))
    print("LIVE_BRIDGE_APPCHECK_INTEGRATION:", "PRESENT_SOURCE_HINT" if has_appcheck else "NOT_FOUND_IN_BRIDGE")
    import hashlib
    from pathlib import Path
    local=Path("firebase-staging/firebase-packing-bridge.js").read_bytes()
    live=source.encode("utf-8")
    print("LIVE_BRIDGE_SHA256:", hashlib.sha256(live).hexdigest())
    print("REPO_BRIDGE_SHA256:", hashlib.sha256(local).hexdigest())
    print("LIVE_BRIDGE_EQUALS_REPO:", "YES" if local==live else "NO")
    indicators={
      "FIREBASE_APPCHECK_IMPORT": "firebase-app-check" in source,
      "INITIALIZE_APPCHECK": "initializeAppCheck(" in source,
      "RECAPTCHA_PROVIDER": bool(re.search(r'ReCaptcha(?:Enterprise)?Provider',source)),
      "APPCHECK_TOKEN_GET": "getToken(" in source,
      "FIREBASE_BRIDGE_READY": "PACKTOOK_FIREBASE" in source
    }
    for k,v in indicators.items(): print("LIVE_"+k+":", "YES" if v else "NO")
    print("OWNER_AUTHENTICATED_LOGIN: NOT_EXECUTED")
    print("APPCHECK_ATTESTATION_AND_REPLAY: NOT_EXECUTED")
    print("OMISE_TEST_MODE_READ: NOT_EXECUTED")
    print("BROWSER_PUBLIC_READ_ONLY: PASS")
    browser.close()
