#!/usr/bin/env python3
"""Read-only PACKTOOK V7 Staging bridge security triage.
Only emits classifications, no JS/HTML, keys, site-specific IDs, or credentials.
A PASS here never overrides Hosting byte-parity gate.
"""
import importlib.util
import os
import pathlib
import re
import subprocess
import urllib.error

base=pathlib.Path(__file__).with_name("rr-v7-staging-hosting-parity-readonly.py")
spec=importlib.util.spec_from_file_location("v7base",base)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def query_ver(ref):
    return ref.partition("?")[2] if "?" in ref else "NONE"
def scripts(data):
    return re.findall(r'<script\b[^>]*\bsrc=["\x27]([^"\x27]+)',data.decode("utf-8","replace"),re.I)
def html_report(a,b):
    source=scripts(a);host=scripts(b)
    if len(source)!=len(host):return ["SCRIPT_COUNT_MISMATCH"]
    lines=[]
    for i,(x,y) in enumerate(zip(source,host),1):
        if x==y:continue
        if x.split("?",1)[0]==y.split("?",1)[0]:
            lines.extend(("DIFFERENT_SCRIPT_POSITION: "+str(i),
                          "DIFFERENCE_TYPE: VERSION_QUERY_ONLY",
                          "SOURCE_VERSION: "+safe_ver(query_ver(x)),
                          "HOSTING_VERSION: "+safe_ver(query_ver(y))))
        else:
            lines.extend(("DIFFERENT_SCRIPT_POSITION: "+str(i),
                          "DIFFERENCE_TYPE: SCRIPT_FILENAME_OR_ORIGIN_CHANGE"))
    return lines or ["SCRIPT_REFERENCES_IDENTICAL"]
def safe_ver(x):
    if re.fullmatch(r"v=[a-zA-Z0-9_.-]{1,30}",x):return x
    return "NONSTANDARD_OR_UNSET"
def check_bridge(data):
    s=data.decode("utf-8","replace")
    init=re.search(r"\binitializeAppCheck\s*\(",s)
    app=re.search(r"\binitializeApp\s*\(",s)
    recaptcha="ReCaptchaEnterpriseProvider" in s
    config="./firebase-v4-config.js" in s
    region=re.search(r'getFunctions\s*\([^\n]{0,120}["\x27]asia-southeast1["\x27]',s)
    callable="httpsCallable" in s
    status={
        "APP_CHECK_IMPORT_OR_REFERENCE":bool(re.search(r"\binitializeAppCheck\b",s)),
        "APP_CHECK_INITIALIZATION_CALL":bool(init),
        "ENTERPRISE_PROVIDER_REFERENCE":recaptcha,
        "FIREBASE_INITIALIZATION_PRESENT":bool(app),
        "STAGING_CONFIG_IMPORT":config,
        "EXPECTED_FUNCTIONS_REGION":bool(region),
        "CALLABLE_WRAPPER_PRESENT":callable,
    }
    # Static ordering alone does not verify whether SDK initialization runs,
    # whether App Check tokens are supplied, or whether backend enforcement is ON.
    if init and app:
        status["APP_CHECK_AFTER_APP_INITIALIZATION"]=init.start()>app.start()
    else:status["APP_CHECK_AFTER_APP_INITIALIZATION"]=False
    return status
def report(local_html,remote_html,local_bridge,remote_bridge):
    for line in html_report(local_html,remote_html):print(line)
    a,b=check_bridge(local_bridge),check_bridge(remote_bridge)
    for key in a:
        print("SOURCE_"+key+":","YES" if a[key] else "NO")
        print("HOSTING_"+key+":","YES" if b[key] else "NO")
    if not b["STAGING_CONFIG_IMPORT"] or not b["EXPECTED_FUNCTIONS_REGION"]:
        print("SECURITY_REVIEW: CONFIG_OR_REGION_BLOCKED")
    elif b["APP_CHECK_INITIALIZATION_CALL"] and not b["APP_CHECK_AFTER_APP_INITIALIZATION"]:
        print("SECURITY_REVIEW: APP_CHECK_ORDER_REQUIRES_REVIEW")
    else:
        print("SECURITY_REVIEW: DEPLOYED_LOGIC_REQUIRES_REVIEW")
    print("APP_CHECK_BACKEND_ENFORCEMENT: NOT_VERIFIED")
    print("HOSTING_BYTE_PARITY:","PASS" if local_html==remote_html and local_bridge==remote_bridge else "BLOCKED_DRIFT")
def run():
    try:
        if os.environ.get("RR_STAGING_PROJECT_ID")!="packtook-staging":raise ValueError("STAGING_REQUIRED")
        if any(os.environ.get(k) for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
            raise ValueError("UNSAFE_ENV")
        current=subprocess.check_output(["gcloud","config","get-value","project"],text=True,stderr=subprocess.DEVNULL).strip()
        if current!="packtook-staging":raise ValueError("GCLOUD_PROJECT_MISMATCH")
        root=pathlib.Path(__file__).resolve().parents[2]/"firebase-staging"
        local_html=(root/"index.html").read_bytes()
        local_bridge=(root/"firebase-packing-bridge.js").read_bytes()
        url="https://packtook-staging.web.app"
        remote_html=m.fetch(m.asset_url(url,"index.html"))
        remote_bridge=m.fetch(m.asset_url(url,"firebase-packing-bridge.js"))
        report(local_html,remote_html,local_bridge,remote_bridge)
    except (OSError,ValueError,subprocess.CalledProcessError,urllib.error.URLError):
        print("V7_SECURITY_TRIAGE: BLOCKED_FETCH_OR_ENVIRONMENT")
    finally:
        print("CLOUD_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")
if __name__=="__main__":run()
