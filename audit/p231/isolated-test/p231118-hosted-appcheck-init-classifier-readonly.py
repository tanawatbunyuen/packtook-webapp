#!/usr/bin/env python3
"""P231.118 — static classification of served Staging App Check initialization.
GET-only; no logging source, site keys, credentials, app IDs, or error bodies.
Static lexical classification is NOT browser execution or attestation proof.
"""
import re
import subprocess
import sys
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

PROJECT = "packtook-staging"
HOST = "packtook-staging.web.app"
LIMIT = 450000
print("P231_CHECK=HOSTED_STAGING_APPCHECK_INIT_CLASSIFICATION_READONLY",flush=True)

class DenyRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        raise ValueError("redirect_not_allowed")

def fetch(path):
    with build_opener(DenyRedirect).open(Request(
        "https://"+HOST+path, method="GET",
        headers={"User-Agent":"PACKTOOK-P231-readonly"}), timeout=20) as r:
        if r.status != 200 or "javascript" not in r.headers.get_content_type().lower():
            raise ValueError("wrong_file_or_content_type")
        raw=r.read(LIMIT+1)
    if len(raw)>LIMIT: raise ValueError("oversize")
    return raw.decode("utf-8")

try:
    project=subprocess.check_output(
       ["gcloud","config","get-value","project"],
       text=True,stderr=subprocess.DEVNULL,timeout=15).strip()
    if project!=PROJECT:
        print("P231_GATE=BLOCKED_NOT_STAGING");sys.exit(2)
    bridge=fetch("/firebase-packing-bridge.js")
    cfg=fetch("/firebase-v4-config.js")
except (HTTPError, URLError, ValueError, TimeoutError, UnicodeError,
        subprocess.SubprocessError, OSError):
    print("P231_HOSTED_FILES=UNAVAILABLE")
    print("P231_RELEASE=NO_GO")
    sys.exit(2)

def yn(v): return "YES" if v else "NO"
# Values and sources remain in memory only; never print source or regex captures.
init_call=bool(re.search(r"(?<![\w$.])initializeAppCheck\s*\(",bridge))
provider_ctor=bool(re.search(r"new\s+ReCaptchaEnterpriseProvider\s*\(",bridge))
import_from_cfg=bool(re.search(
    r"import\s*\{[^}]*\brecaptchaEnterpriseSiteKey\b[^}]*\}\s*from\s*['\"]\./firebase-v4-config\.js",
    bridge,re.S))
import_from_other=bool(re.search(
    r"import\s*\{[^}]*\brecaptchaEnterpriseSiteKey\b[^}]*\}\s*from\s*['\"](?!\./firebase-v4-config\.js)",
    bridge,re.S))
key_reference=bool(re.search(r"\brecaptchaEnterpriseSiteKey\b",bridge))
local_decl=bool(re.search(
    r"(?:const|let|var)\s+recaptchaEnterpriseSiteKey\s*=",bridge))
cfg_export=bool(re.search(
    r"export\s+(?:const|let|var)\s+recaptchaEnterpriseSiteKey\b",cfg))
# Presence in bridge of direct siteKey references does not imply a valid key.
sitekey_prop=bool(re.search(r"\bsiteKey\b",bridge))
legacy_provider=bool(re.search(r"ReCaptchaV3Provider|ReCaptchaEnterpriseProvider",bridge))
debug_flag=bool(re.search(r"FIREBASE_APPCHECK_DEBUG_TOKEN",bridge))
print("P231_HOSTED_INIT_APPCHECK_CALL="+yn(init_call))
print("P231_HOSTED_ENTERPRISE_PROVIDER_CONSTRUCT="+yn(provider_ctor))
print("P231_HOSTED_SITE_KEY_IMPORT_FROM_CONFIG="+yn(import_from_cfg))
print("P231_HOSTED_SITE_KEY_IMPORT_FROM_OTHER="+yn(import_from_other))
print("P231_HOSTED_SITE_KEY_LOCAL_DECLARATION="+yn(local_decl))
print("P231_HOSTED_SITE_KEY_SYMBOL_REFERENCE="+yn(key_reference))
print("P231_HOSTED_CONFIG_SITE_KEY_EXPORT="+yn(cfg_export))
print("P231_HOSTED_BRIDGE_SITEKEY_PROPERTY_REFERENCE="+yn(sitekey_prop))
print("P231_HOSTED_DEBUG_FLAG_REFERENCE="+yn(debug_flag))
if import_from_cfg and not cfg_export:
    state="STATIC_MISSING_NAMED_EXPORT"
elif not init_call:
    state="NO_INITIALIZATION_CALL_DETECTED"
elif not provider_ctor:
    state="NO_ENTERPRISE_PROVIDER_CONSTRUCTOR_DETECTED"
elif import_from_cfg and cfg_export:
    state="CONFIG_IMPORT_PATH_PRESENT"
elif local_decl:
    state="LOCAL_SITE_KEY_SOURCE_PRESENT_VALUE_UNVERIFIED"
elif import_from_other:
    state="OTHER_MODULE_SITE_KEY_SOURCE_PRESENT"
else:
    state="SITE_KEY_SOURCE_NOT_CLASSIFIED"
print("P231_HOSTED_APP_CHECK_SOURCE_CLASS="+state)
print("P231_BROWSER_RUNTIME_INIT=NOT_VERIFIED")
print("P231_REAL_ATTESTATION=NOT_PERFORMED")
print("P231_VALID_APP_CHECK_TOKEN=NOT_MINTED")
print("P231_E2E=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
# Classification, even if inconclusive, is a completed read-only audit.
