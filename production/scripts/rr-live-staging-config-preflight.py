#!/usr/bin/env python3
"""Read-only live PACKTOOK staging config attestation, without credentials.
Do not issue Auth, App Check, Omise or Firestore API calls.
"""
import json, re, urllib.request
origin="https://packtook-staging.web.app"
paths=["/","/firebase-v4-config.js","/firebase-packing-bridge.js"]
body={}
for path in paths:
    req=urllib.request.Request(origin+path,method="GET",headers={"Accept":"text/html,application/javascript,*/*"})
    with urllib.request.urlopen(req,timeout=25) as response:
        assert response.status==200, f"HTTP_{response.status}"
        body[path]=response.read(300_000).decode("utf-8")
        print("PUBLIC_ASSET_OK:",path)
index=body["/"]
config=body["/firebase-v4-config.js"]
bridge=body["/firebase-packing-bridge.js"]
assert 'id="loginForm"' in index and 'id="loginPage"' in index
assert re.search(r'projectId\s*:\s*["\']packtook-staging["\']',config), "wrong firebase project"
assert re.search(r'authDomain\s*:\s*["\']packtook-staging\.firebaseapp\.com["\']',config), "wrong auth domain"
assert "asia-southeast1" in bridge and "httpsCallable" in bridge
assert "firebase-app-check" in bridge, "App Check integration source hint missing"
assert "initializeAppCheck" in bridge, "App Check initialization missing"
print("LIVE_STAGING_PROJECT_AND_AUTH_DOMAIN: PASS")
print("LIVE_STAGING_FUNCTION_REGION_HINT: PASS")
print("LIVE_STAGING_APPCHECK_SOURCE_HINT: PASS")
print("OWNER_LOGIN: USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED")
print("OMISE_TEST_CHARGE_EXISTS: USER_ATTESTED_NOT_INDEPENDENTLY_VERIFIED")
print("OMISE_TEST_SECRET_MANAGER: NOT_CONFIGURED")
print("LIVE_APPCHECK_TOKEN: NOT_RETESTED_THROTTLED")
print("LIVE_OMISE_PROVIDER_API_GET: NOT_EXECUTED")
print("PUBLIC_READ_ONLY_STAGING_PREFLIGHT: PASS")
print("RELEASE: NO_GO_RELEASE")
