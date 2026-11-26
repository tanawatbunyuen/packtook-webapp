#!/usr/bin/env python3
"""P231.109 staging-only App Check authorization diagnostics (GET and testIamPermissions).
Prints no app IDs, project numbers, tokens, account identities, or error bodies.
No IAM changes, token exchange, deployment, invocation or cleanup.
"""
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT = "packtook-staging"
PERMISSIONS = [
    "firebaseappcheck.recaptchaEnterpriseConfig.get",
    "firebaseappcheck.recaptchaV3Config.get",
]
print("P231_CHECK=APPCHECK_PERMISSION_DIAGNOSTIC_READONLY", flush=True)

def command(argv):
    return subprocess.check_output(argv, stderr=subprocess.DEVNULL,
                                   timeout=25, text=True).strip()

try:
    if command(["gcloud", "config", "get-value", "project"]) != PROJECT:
        print("P231_GATE=BLOCKED_NOT_STAGING"); sys.exit(2)
    active = [s for s in command(["gcloud", "auth", "list",
                                  "--filter=status:ACTIVE",
                                  "--format=value(account)"]).splitlines() if s]
    if len(active) != 1:
        print("P231_GATE=BLOCKED_OPERATOR_NOT_UNIQUE"); sys.exit(2)
    token = command(["gcloud", "auth", "print-access-token"])
    apps = json.loads(command(["firebase", "apps:list", "--project", PROJECT, "--json"]))
    if apps.get("status") not in (None, "success"):
        raise ValueError("Firebase CLI failure")
    arr = apps.get("result", apps.get("apps"))
    if not isinstance(arr, list):
        raise ValueError("Unknown app schema")
    web = [a for a in arr if str(a.get("platform", a.get("type", ""))).upper()=="WEB"]
    if len(web) != 1: raise ValueError("Expected one web app")
    app_id = web[0].get("appId", web[0].get("app_id"))
    number = command(["gcloud", "projects", "describe", PROJECT,
                      "--format=value(projectNumber)"])
    if not isinstance(app_id,str) or "/" in app_id or not app_id or not number.isdecimal():
        raise ValueError("Invalid app reference")
except Exception:
    print("P231_PREREQUISITES=INCOMPLETE")
    sys.exit(2)

print("P231_STAGING_APP=ONE_WEB_APP_RESOLVED_IN_MEMORY")
headers={"Authorization":"Bearer "+token,"Content-Type":"application/json"}
req=Request("https://cloudresourcemanager.googleapis.com/v1/projects/"+
            PROJECT+":testIamPermissions",
            data=json.dumps({"permissions":PERMISSIONS}).encode(),
            headers=headers, method="POST")
try:
    with urlopen(req,timeout=15) as resp:
        response=json.load(resp)
    granted=set(response.get("permissions", []))
    iam_ok=True
except (HTTPError,URLError,ValueError,TimeoutError):
    granted=set()
    iam_ok=False

if not iam_ok:
    print("P231_APP_CHECK_IAM_PROBE=UNAVAILABLE")
else:
    print("P231_APP_CHECK_IAM_PROBE=READABLE")
for key,permission in zip(["ENTERPRISE_GET","V3_GET"],PERMISSIONS):
    print("P231_"+key+"_PERMISSION="+
          ("ALLOWED" if permission in granted else "NOT_GRANTED_OR_DENIED"))

for key,resource in [
    ("ENTERPRISE","recaptchaEnterpriseConfig"),
    ("V3","recaptchaV3Config"),
]:
    url=("https://firebaseappcheck.googleapis.com/v1/projects/"+number+
         "/apps/"+app_id+"/"+resource)
    try:
        with urlopen(Request(url,headers={"Authorization":"Bearer "+token},
                             method="GET"),timeout=15) as resp:
            resp.read(1)
            status="HTTP_200_CONFIG_PRESENT"
    except HTTPError as exc:
        status="HTTP_"+str(exc.code)
    except (URLError,TimeoutError,ValueError):
        status="NETWORK_OR_PARSE_ERROR"
    print("P231_"+key+"_CONFIG_HTTP="+status)

print("P231_HTTP_ERROR_BODY=NOT_PRINTED")
print("P231_SCOPE_OR_IAM_ROOT_CAUSE=NOT_CONCLUSIVELY_DETERMINED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_APP_CHECK_TOKEN=NOT_MINTED")
print("P231_E2E=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
# Diagnostics completed even if permissions denied; never signal E2E readiness.
