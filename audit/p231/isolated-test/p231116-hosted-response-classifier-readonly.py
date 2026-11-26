#!/usr/bin/env python3
"""P231.116: classify each staging Hosting response separately (GET only).
Prints no fetched text, keys, tokens, app IDs, raw URLs or header values.
"""
import re
import subprocess
import sys
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

PROJECT="packtook-staging"
HOST="packtook-staging.web.app"
MAX_BYTES=450_000
print("P231_CHECK=HOSTED_STAGING_RESPONSE_CLASSIFIER_READONLY",flush=True)

class RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("REDIRECT_BLOCKED")

try:
    selected=subprocess.check_output(
        ["gcloud","config","get-value","project"],text=True,
        stderr=subprocess.DEVNULL,timeout=15).strip()
except Exception:
    selected=""
if selected!=PROJECT:
    print("P231_GATE=BLOCKED_NOT_STAGING");sys.exit(2)
opener=build_opener(RejectRedirect)

def inspect(label,path):
    try:
        req=Request("https://"+HOST+path,method="GET",
                    headers={"User-Agent":"PACKTOOK-P231-readonly"})
        with opener.open(req,timeout=18) as response:
            status=response.status
            mime=response.headers.get_content_type().lower()
            raw=response.read(MAX_BYTES+1)
        if len(raw)>MAX_BYTES: raise ValueError("OVERSIZE")
        body=raw.decode("utf8")
    except HTTPError as e:
        print(f"P231_{label}_HTTP={e.code}")
        return False
    except (URLError,TimeoutError,UnicodeError,ValueError):
        print(f"P231_{label}_HTTP=UNAVAILABLE_OR_REDIRECT")
        return False
    # Print safe, low-cardinality classifications only.
    print(f"P231_{label}_HTTP={status}")
    print(f"P231_{label}_MIME_CLASS="+
          ("HTML" if mime=="text/html" else
           "JAVASCRIPT" if "javascript" in mime else
           "TEXT" if mime=="text/plain" else "OTHER"))
    html=bool(re.search(r"<!doctype\s+html|<html(?:\s|>)",body[:2000],re.I))
    print(f"P231_{label}_LOOKS_HTML="+("YES" if html else "NO"))
    if label=="CONFIG":
        print("P231_CONFIG_EXPORT_FIREBASE="+("YES" if bool(re.search(
            r"export\s+(?:const|let|var)\s+firebaseConfig\b",body)) else "NO"))
        print("P231_CONFIG_SITE_KEY_SYMBOL="+("YES" if "recaptchaEnterpriseSiteKey" in body else "NO"))
        m=re.search(r"export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(['\"])(.*?)\1\s*;",body,re.S)
        print("P231_CONFIG_SITE_KEY_STATE="+
              ("NONEMPTY" if m and m.group(2).strip() else
               "EMPTY" if m else "NOT_PARSEABLE"))
        print("P231_CONFIG_PROJECT_STAGING="+
              ("YES" if bool(re.search(r"projectId\s*:\s*['\"]packtook-staging['\"]",body)) else "NOT_PROVEN"))
    elif label=="BRIDGE":
        print("P231_BRIDGE_INITIALIZE_APPCHECK="+("YES" if "initializeAppCheck" in body else "NO"))
        print("P231_BRIDGE_ENTERPRISE_PROVIDER="+("YES" if "ReCaptchaEnterpriseProvider" in body else "NO"))
    elif label=="INDEX":
        print("P231_INDEX_BRIDGE_REF="+("YES" if "firebase-packing-bridge.js" in body else "NO"))
    return status==200

ok={}
for name,path in [("CONFIG","/firebase-v4-config.js"),
                  ("BRIDGE","/firebase-packing-bridge.js"),
                  ("INDEX","/")]:
    ok[name]=inspect(name,path)
print("P231_ALL_THREE_HTTP_200="+("YES" if all(ok.values()) else "NO"))
print("P231_DEPLOYED_SOURCE_REVISION=NOT_VERIFIED")
print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_BROWSER_ATTESTATION=NOT_PERFORMED")
print("P231_E2E=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
sys.exit(0 if all(ok.values()) else 2)
