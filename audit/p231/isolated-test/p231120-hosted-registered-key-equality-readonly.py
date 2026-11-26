#!/usr/bin/env python3
"""P231.120 — compare hosted Enterprise site key to registered staging key in memory only."""
import json,re,subprocess,sys
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError,URLError
PROJECT="packtook-staging"
HOST="packtook-staging.web.app"
print("P231_CHECK=HOSTED_SITE_KEY_REGISTERED_EQUIVALENCE_READONLY",flush=True)
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        raise ValueError("redirect blocked")
def cmd(args):
    return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL,timeout=25).strip()
try:
    if cmd(["gcloud","config","get-value","project"])!=PROJECT:
        print("P231_GATE=BLOCKED_NOT_STAGING");sys.exit(2)
    active=[x for x in cmd(["gcloud","auth","list","--filter=status:ACTIVE","--format=value(account)"]).splitlines() if x]
    if len(active)!=1:raise ValueError("operator ambiguity")
    listing=json.loads(cmd(["firebase","apps:list","--project",PROJECT,"--json"]))
    if listing.get("status") not in (None,"success"):raise ValueError("app listing status")
    arr=listing.get("result",listing.get("apps"))
    if not isinstance(arr,list):raise ValueError("app listing schema")
    web=[x for x in arr if str(x.get("platform",x.get("type",""))).upper()=="WEB"]
    if len(web)!=1:raise ValueError("expected one staging web app")
    appid=web[0].get("appId",web[0].get("app_id"))
    number=cmd(["gcloud","projects","describe",PROJECT,"--format=value(projectNumber)"])
    token=cmd(["gcloud","auth","print-access-token"])
    if not isinstance(appid,str) or not appid or "/" in appid or not number.isdecimal() or not token:
        raise ValueError("invalid project parameters")
    with build_opener(NoRedirect).open(Request("https://"+HOST+"/firebase-packing-bridge.js",method="GET"),timeout=20) as response:
        if response.status!=200 or "javascript" not in response.headers.get_content_type().lower():
            raise ValueError("unexpected hosted script")
        raw=response.read(450001)
    if len(raw)>450000:raise ValueError("script size")
    hosted=raw.decode("utf-8")
    api="https://firebaseappcheck.googleapis.com/v1/projects/"+number+"/apps/"+appid+"/recaptchaEnterpriseConfig"
    req=Request(api,method="GET",headers={"Authorization":"Bearer "+token,"X-Goog-User-Project":PROJECT})
    with build_opener(NoRedirect).open(req,timeout=20) as response:
        if response.status!=200:raise ValueError("App Check provider GET failed")
        raw=response.read(100001)
    if len(raw)>100000:raise ValueError("config response too large")
    config=json.loads(raw)
    registered=config.get("siteKey")
    if not isinstance(registered,str) or not registered.strip():
        raise ValueError("no registered site key")
except (OSError,ValueError,TimeoutError,UnicodeError,HTTPError,URLError,subprocess.SubprocessError):
    print("P231_KEY_COMPARISON=PREREQUISITES_UNAVAILABLE");sys.exit(2)
matches=list(re.finditer(r"\bnew\s+ReCaptchaEnterpriseProvider\s*\(",hosted))
if len(matches)!=1:
    print("P231_KEY_COMPARISON=CONSTRUCTOR_NOT_UNIQUE");sys.exit(2)
arg=hosted[matches[0].end():matches[0].end()+2048].lstrip()
if not arg or arg[0] not in (chr(34),chr(39)):
    print("P231_KEY_COMPARISON=NOT_SIMPLE_LITERAL");sys.exit(2)
delimiter=arg[0];end=None;escaped=False
for i,ch in enumerate(arg[1:],start=1):
    if escaped:escaped=False;continue
    if ord(ch)==92:escaped=True;continue
    if ch==delimiter:end=i;break
if end is None or not arg[end+1:].lstrip().startswith(")"):
    print("P231_KEY_COMPARISON=NOT_SIMPLE_LITERAL");sys.exit(2)
candidate=arg[1:end]
if not candidate or chr(92) in candidate:
    print("P231_KEY_COMPARISON=UNSUPPORTED_ESCAPED_OR_EMPTY");sys.exit(2)
print("P231_HOSTED_SITE_KEY_CLASS=NONEMPTY_SIMPLE_LITERAL")
print("P231_REGISTERED_ENTERPRISE_KEY_CLASS=NONEMPTY")
print("P231_HOSTED_REGISTERED_SITE_KEY="+("MATCH" if candidate==registered else "MISMATCH"))
print("P231_SITE_KEY_VALUES=NEVER_PRINTED")
print("P231_SITE_KEY_DOMAIN_ALLOWLIST=NOT_VERIFIED")
print("P231_BROWSER_ATTESTATION=NOT_PERFORMED")
print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED")
print("P231_E2E=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
if candidate!=registered:sys.exit(3)
