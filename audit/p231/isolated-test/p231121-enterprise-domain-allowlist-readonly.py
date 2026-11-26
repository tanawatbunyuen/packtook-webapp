#!/usr/bin/env python3
"""P231.121 — Inspect reCAPTCHA Enterprise allowed domains READ ONLY. No key values printed."""
import json,subprocess,sys
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
PROJECT="packtook-staging"
HOST="packtook-staging.web.app"
print("P231_CHECK=RECAPTCHA_ENTERPRISE_DOMAIN_ALLOWLIST_READONLY",flush=True)
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,url):
        raise ValueError("redirect blocked")
def cmd(args):
    return subprocess.check_output(args,stderr=subprocess.DEVNULL,text=True,timeout=25).strip()
try:
    if cmd(["gcloud","config","get-value","project"])!=PROJECT:
        print("P231_GATE=BLOCKED_NOT_STAGING");sys.exit(2)
    active=[x for x in cmd(["gcloud","auth","list","--filter=status:ACTIVE","--format=value(account)"]).splitlines() if x]
    if len(active)!=1:raise ValueError("ambiguous operator")
    apps=json.loads(cmd(["firebase","apps:list","--project",PROJECT,"--json"]))
    if apps.get("status") not in (None,"success"):raise ValueError("firebase list status")
    listing=apps.get("result",apps.get("apps"))
    if not isinstance(listing,list):raise ValueError("unexpected app list")
    web=[x for x in listing if str(x.get("platform",x.get("type",""))).upper()=="WEB"]
    if len(web)!=1:raise ValueError("expected one web app")
    appid=web[0].get("appId",web[0].get("app_id"))
    num=cmd(["gcloud","projects","describe",PROJECT,"--format=value(projectNumber)"])
    token=cmd(["gcloud","auth","print-access-token"])
    if not isinstance(appid,str) or not appid or "/" in appid or not num.isdecimal() or not token:
        raise ValueError("prerequisites invalid")
    headers={"Authorization":"Bearer "+token,"X-Goog-User-Project":PROJECT}
    api="https://firebaseappcheck.googleapis.com/v1/projects/"+num+"/apps/"+appid+"/recaptchaEnterpriseConfig"
    req=Request(api,method="GET",headers=headers)
    with build_opener(NoRedirect).open(req,timeout=20) as resp:
        if resp.status!=200:raise ValueError("appcheck config read")
        raw=resp.read(100001)
    if len(raw)>100000:raise ValueError("response too long")
    config=json.loads(raw)
    key=config.get("siteKey")
    if not isinstance(key,str) or not key.strip() or "/" in key:
        raise ValueError("invalid registered key id")
    # reCAPTCHA Enterprise site key is used as the key resource id.
    keyurl="https://recaptchaenterprise.googleapis.com/v1/projects/"+PROJECT+"/keys/"+key
    with build_opener(NoRedirect).open(Request(keyurl,method="GET",headers=headers),timeout=20) as resp:
        if resp.status!=200:raise ValueError("recaptcha key read")
        raw=resp.read(100001)
    if len(raw)>100000:raise ValueError("key response too long")
    record=json.loads(raw)
except HTTPError as e:
    print("P231_RECAPTCHA_KEY_GET_HTTP=HTTP_"+str(e.code))
    print("P231_DOMAIN_ALLOWLIST=NOT_VERIFIED")
    print("P231_RELEASE=NO_GO");sys.exit(2)
except (ValueError,URLError,TimeoutError,UnicodeError,subprocess.SubprocessError,OSError):
    print("P231_RECAPTCHA_KEY_GET=UNAVAILABLE_OR_UNEXPECTED")
    print("P231_DOMAIN_ALLOWLIST=NOT_VERIFIED")
    print("P231_RELEASE=NO_GO");sys.exit(2)
websettings=record.get("webSettings")
if not isinstance(websettings,dict):
    print("P231_RECAPTCHA_WEB_SETTINGS=NOT_PRESENT_OR_WRONG_KEY_TYPE");sys.exit(2)
allow_all=websettings.get("allowAllDomains") is True
domains=websettings.get("allowedDomains",[])
if not isinstance(domains,list):
    print("P231_RECAPTCHA_ALLOWED_DOMAINS=UNEXPECTED_SCHEMA");sys.exit(2)
normalized=[d.strip().lower().rstrip(".") for d in domains if isinstance(d,str)]
def matches(host,domain):
    return host==domain or host.endswith("."+domain)
allowed=any(matches(HOST,d) for d in normalized if d)
print("P231_RECAPTCHA_KEY_GET_HTTP=HTTP_200")
print("P231_ALLOW_ALL_DOMAINS="+("YES_SECURITY_REVIEW" if allow_all else "NO"))
print("P231_STAGING_HOST_ALLOWED="+("YES" if allowed else "NO"))
print("P231_ALLOWED_DOMAIN_COUNT="+str(len(normalized)))
print("P231_DOMAIN_ALLOWLIST_GATE="+("ALLOW_ALL_SECURITY_REVIEW" if allow_all else "PASS" if allowed else "BLOCKED"))
print("P231_ALLOWED_DOMAIN_VALUES=NOT_PRINTED")
print("P231_SITE_KEY_VALUES=NEVER_PRINTED")
print("P231_BROWSER_ATTESTATION=NOT_PERFORMED")
print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_E2E=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
sys.exit(0 if allowed and not allow_all else 3)
