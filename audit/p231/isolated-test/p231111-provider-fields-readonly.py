#!/usr/bin/env python3
"""P231.111 — Inspect sanitized App Check provider metadata, GET only.
Does not print or persist app IDs, project numbers, site keys, secrets, or tokens.
"""
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT = "packtook-staging"
print("P231_CHECK=STAGING_APPCHECK_PROVIDER_FIELDS_READONLY", flush=True)

def cmd(args):
    return subprocess.check_output(args, stderr=subprocess.DEVNULL,
                                   text=True, timeout=25).strip()

try:
    if cmd(["gcloud", "config", "get-value", "project"]) != PROJECT:
        print("P231_GATE=BLOCKED_PROJECT"); sys.exit(2)
    operator = [x for x in cmd(["gcloud", "auth", "list", "--filter=status:ACTIVE",
                                "--format=value(account)"]).splitlines() if x]
    if len(operator) != 1: raise ValueError("operator not unique")
    apps = json.loads(cmd(["firebase", "apps:list", "--project", PROJECT, "--json"]))
    if apps.get("status") not in (None, "success"): raise ValueError("firebase CLI app status")
    arr = apps.get("result", apps.get("apps"))
    if not isinstance(arr, list): raise ValueError("firebase app list format")
    web = [x for x in arr if str(x.get("platform", x.get("type", ""))).upper() == "WEB"]
    if len(web) != 1: raise ValueError("expected one web app")
    app_id = web[0].get("appId", web[0].get("app_id"))
    project_number = cmd(["gcloud", "projects", "describe", PROJECT,
                          "--format=value(projectNumber)"])
    access_token = cmd(["gcloud", "auth", "print-access-token"])
    if (not isinstance(app_id, str) or not app_id or "/" in app_id
            or not project_number.isdecimal() or not access_token):
        raise ValueError("invalid project/app parameters")
except Exception:
    print("P231_GATE=PREREQUISITES_UNAVAILABLE"); sys.exit(2)

print("P231_STAGING_REGISTERED_WEB_APPS=1")
headers={"Authorization": "Bearer " + access_token,
         "X-Goog-User-Project": PROJECT}
prefix=f"https://firebaseappcheck.googleapis.com/v1/projects/{project_number}/apps/{app_id}"
errors=0
for label,suffix in [("ENTERPRISE","recaptchaEnterpriseConfig"),
                     ("V3","recaptchaV3Config")]:
    try:
        with urlopen(Request(prefix+"/"+suffix, headers=headers, method="GET"),
                     timeout=20) as response:
            obj=json.load(response)
        if not isinstance(obj,dict): raise ValueError("unexpected response")
        print(f"P231_{label}_HTTP=200")
        if label == "ENTERPRISE":
            has_key=isinstance(obj.get("siteKey"),str) and bool(obj["siteKey"].strip())
            print("P231_ENTERPRISE_SITE_KEY_PRESENT="+("YES" if has_key else "NO"))
            print("P231_ENTERPRISE_CONFIG_METADATA="+
                  ("KEY_PRESENT_NOT_ATTESTED" if has_key else "NO_KEY_IN_RESPONSE"))
        else:
            # Firebase REST intentionally redacts siteSecret in GET responses.
            # Never infer whether v3 is configured from 200 or an empty secret.
            print("P231_V3_SECRET_CONFIGURED=NOT_DETERMINABLE_FROM_GET")
        ttl=obj.get("tokenTtl")
        print(f"P231_{label}_TOKEN_TTL_FIELD="+
              ("PRESENT" if isinstance(ttl,str) and bool(ttl) else "ABSENT"))
    except HTTPError as exc:
        print(f"P231_{label}_HTTP={exc.code}")
        errors+=1
    except (URLError,ValueError,TimeoutError):
        print(f"P231_{label}_HTTP=UNAVAILABLE")
        errors+=1

print("P231_SITE_KEY_AND_SECRET_VALUES=NEVER_PRINTED")
print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_VERIFIED_STAGING_AUTH_USER=NOT_VERIFIED")
print("P231_APP_CHECK_E2E=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
sys.exit(2 if errors else 0)
