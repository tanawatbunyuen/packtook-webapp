#!/usr/bin/env python3
"""P231.115 — inspect *served* staging Hosting config and bridge, READ ONLY.

Checks exclusively the project-owned default staging hostname. Never logs
site keys, Firebase app IDs, API keys, credentials, source bodies or response URLs.
Makes GETs only; no browser attestation, token minting, deploy or IAM changes.
"""
import re
import ssl
import subprocess
import sys
from urllib.request import Request, urlopen, build_opener, HTTPHandler, HTTPSHandler
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

PROJECT = "packtook-staging"
HOST = "packtook-staging.web.app"
BASE = "https://" + HOST
MAX_BYTES = 400_000

print("P231_CHECK=STAGING_HOSTED_APPCHECK_CLIENT_READONLY",flush=True)

def cmd(args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL, timeout=20).strip()

try:
    if cmd(["gcloud","config","get-value","project"]) != PROJECT:
        print("P231_GATE=BLOCKED_NOT_STAGING")
        sys.exit(2)
    if cmd(["git","rev-parse","--is-inside-work-tree"]) != "true":
        raise RuntimeError("Not in repository")
except Exception:
    print("P231_GATE=BLOCKED_LOCAL_PREREQUISITES")
    sys.exit(2)

# Redirects are refused so no GET can silently leave the exact staging domain.
class NoRedirect(HTTPHandler):
    pass
from urllib.request import HTTPRedirectHandler
class RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        raise ValueError("Redirect blocked")

opener = build_opener(RejectRedirect)
def fetch(path):
    url = BASE + path
    if urlsplit(url).hostname != HOST:
        raise ValueError("Unexpected host")
    req = Request(url, method="GET", headers={"User-Agent":"PACKTOOK-P231-readonly-configuration-audit"})
    with opener.open(req, timeout=20) as response:
        if response.status != 200:
            raise ValueError("Not 200")
        content_type = response.headers.get("Content-Type","").lower()
        if not any(x in content_type for x in ("javascript","text/plain","html")):
            raise ValueError("Unexpected content type")
        body=response.read(MAX_BYTES+1)
        if len(body)>MAX_BYTES:
            raise ValueError("Response too large")
        return body.decode("utf-8")

try:
    cfg = fetch("/firebase-v4-config.js")
    bridge = fetch("/firebase-packing-bridge.js")
    page = fetch("/")
except (HTTPError,URLError,TimeoutError,ValueError,UnicodeError) as exc:
    # Fail closed and do not print external error details / URLs.
    print("P231_HOSTED_FILES=UNAVAILABLE_OR_UNEXPECTED")
    print("P231_HTTP_ERROR_CLASS="+type(exc).__name__)
    print("P231_BROWSER_ATTESTATION=NOT_PERFORMED")
    print("P231_RELEASE=NO_GO")
    sys.exit(2)

# Avoid false positive from HTML SPA fallback for missing JS.
if "export const firebaseConfig" not in cfg or "recaptchaEnterpriseSiteKey" not in cfg or "initializeAppCheck" not in bridge:
    print("P231_HOSTED_JS_IDENTITY=FAIL_OR_FALLBACK")
    sys.exit(2)

project_match=bool(re.search(r"projectId\s*:\s*['\"]packtook-staging['\"]",cfg))
site_match=re.search(r"export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(['\"])(.*?)\1\s*;",cfg,re.S)
site_status=("NONEMPTY" if site_match and site_match.group(2).strip()
             else "EMPTY" if site_match else "DYNAMIC_OR_UNPARSEABLE")
init_conditional="initializeAppCheck" in bridge and "ReCaptchaEnterpriseProvider" in bridge
page_loads=bool(re.search(r'<script[^>]+src=["\'][^"\']*firebase-packing-bridge\.js(?:\?[^"\']*)?["\']',page,re.I))
src_marker="firebase-packing-bridge.js" in page
print("P231_HOSTED_CONFIG_HTTP=200")
print("P231_HOSTED_BRIDGE_HTTP=200")
print("P231_HOSTED_INDEX_HTTP=200")
print("P231_HOSTED_PROJECT_ID_MATCH="+("YES" if project_match else "NO"))
print("P231_HOSTED_ENTERPRISE_SITE_KEY="+site_status)
print("P231_HOSTED_BRIDGE_HAS_APPCHECK="+("YES" if init_conditional else "NO"))
print("P231_HOSTED_INDEX_BRIDGE_REFERENCE="+("YES" if src_marker else "NO"))
print("P231_HOSTED_INDEX_MODULE_BRIDGE_SCRIPT="+("YES" if page_loads else "NOT_PROVEN"))
print("P231_HOSTING_REVISION=NOT_VERIFIED")
print("P231_AUTH_TEST_USER=NOT_VERIFIED")
print("P231_APP_CHECK_TOKEN=NOT_MINTED")
print("P231_BROWSER_ATTESTATION=NOT_PERFORMED")
print("P231_CLOUD_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
if not project_match or not init_conditional or not src_marker or site_status == "DYNAMIC_OR_UNPARSEABLE":
    print("P231_HOSTED_CLIENT_GATE=INCOMPLETE")
    sys.exit(2)
print("P231_HOSTED_CLIENT_GATE=READ_ONLY_INSPECTED_NOT_ATTESTED")
