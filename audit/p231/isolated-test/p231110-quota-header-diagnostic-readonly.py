#!/usr/bin/env python3
"""P231.110: diagnose App Check GET 403 using explicit quota project.
No cloud mutation, token exchange, E2E, IAM grants or output of secrets.
"""
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT = "packtook-staging"
print("P231_CHECK=APPCHECK_QUOTA_PROJECT_HEADER_READONLY", flush=True)

def cmd(args):
    return subprocess.check_output(args, text=True, stderr=subprocess.DEVNULL, timeout=25).strip()

try:
    if cmd(["gcloud", "config", "get-value", "project"]) != PROJECT:
        print("P231_GATE=BLOCKED_PROJECT"); sys.exit(2)
    active = [a for a in cmd(["gcloud","auth","list","--filter=status:ACTIVE",
                               "--format=value(account)"]).splitlines() if a]
    if len(active) != 1: raise RuntimeError("active account ambiguous")
    listing = json.loads(cmd(["firebase","apps:list","--project",PROJECT,"--json"]))
    if listing.get("status") not in ("success",None): raise ValueError("apps not readable")
    apps = listing.get("result",listing.get("apps"))
    if not isinstance(apps,list): raise ValueError("bad list")
    web = [a for a in apps if str(a.get("platform",a.get("type",""))).upper()=="WEB"]
    if len(web) != 1: raise ValueError("expected one staging web app")
    appid = web[0].get("appId",web[0].get("app_id"))
    num = cmd(["gcloud","projects","describe",PROJECT,"--format=value(projectNumber)"])
    token = cmd(["gcloud","auth","print-access-token"])
    if not isinstance(appid,str) or "/" in appid or not appid or not num.isdecimal() or not token:
        raise ValueError("invalid private request parameters")
except Exception:
    print("P231_PREREQUISITES=BLOCKED"); sys.exit(2)

try:
    enabled = cmd(["gcloud","services","list","--enabled","--project",PROJECT,
                   "--filter=config.name:firebaseappcheck.googleapis.com",
                   "--format=value(config.name)"]).splitlines()
    print("P231_APPCHECK_API_ENABLED=" + ("YES" if "firebaseappcheck.googleapis.com" in enabled else "NOT_CONFIRMED"))
except Exception:
    print("P231_APPCHECK_API_ENABLED=UNVERIFIED")

payload = json.dumps({"permissions":["serviceusage.services.use"]}).encode()
req = Request("https://cloudresourcemanager.googleapis.com/v1/projects/"+PROJECT+":testIamPermissions",
              data=payload, method="POST", headers={"Authorization":"Bearer "+token,
              "Content-Type":"application/json"})
try:
    with urlopen(req,timeout=15) as resp: allowed=json.load(resp).get("permissions",[])
    print("P231_QUOTA_PROJECT_USE_PERMISSION="+
          ("ALLOWED" if "serviceusage.services.use" in allowed else "NOT_GRANTED_OR_DENIED"))
except (HTTPError,URLError,ValueError,TimeoutError):
    print("P231_QUOTA_PROJECT_USE_PERMISSION=UNVERIFIED")

headers={"Authorization":"Bearer "+token, "X-Goog-User-Project":PROJECT}
for name,resource in [("ENTERPRISE","recaptchaEnterpriseConfig"),
                      ("V3","recaptchaV3Config")]:
    url=f"https://firebaseappcheck.googleapis.com/v1/projects/{num}/apps/{appid}/{resource}"
    try:
        with urlopen(Request(url,method="GET",headers=headers),timeout=15) as resp:
            # Do not display, save or inspect config contents (may contain site metadata).
            resp.read(1)
        state="HTTP_200"
    except HTTPError as exc:
        state=f"HTTP_{exc.code}"
    except (URLError,TimeoutError,ValueError):
        state="NETWORK_ERROR"
    print(f"P231_{name}_WITH_QUOTA_HEADER={state}")

print("P231_RAW_ERROR_BODY=NOT_READ")
print("P231_TOKEN_VALUE=NOT_PRINTED")
print("P231_NEW_IAM_GRANTS=0")
print("P231_PROVIDER_CHANGES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_E2E=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RUNTIME_APPCHECK=NOT_VERIFIED")
print("P231_RELEASE=NO_GO")
