#!/usr/bin/env python3
"""P231.108 — Inspect staging App Check Web provider config, read-only.
Google Cloud app credentials remain in-memory. Print no App ID, site key,
access token, provider response, or user details. No App Check token exchange.
"""
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT = "packtook-staging"
print("P231_CHECK=STAGING_WEB_APPCHECK_PROVIDER_READONLY", flush=True)


def call(args):
    return subprocess.check_output(args, stderr=subprocess.DEVNULL, timeout=25).decode().strip()


try:
    if call(["gcloud", "config", "get-value", "project"]) != PROJECT:
        print("P231_GATE=BLOCKED_PROJECT")
        sys.exit(2)
    accounts = [x for x in call(["gcloud", "auth", "list", "--filter=status:ACTIVE",
                                "--format=value(account)"]).splitlines() if x]
    if len(accounts) != 1:
        print("P231_GATE=BLOCKED_ACTIVE_OPERATOR")
        sys.exit(2)
    app_listing = json.loads(call(["firebase", "apps:list", "--project", PROJECT, "--json"]))
    if app_listing.get("status") not in (None, "success"):
        raise ValueError("Firebase CLI error")
    entries = app_listing.get("result", app_listing.get("apps"))
    if not isinstance(entries, list):
        raise ValueError("Unrecognized Firebase apps list")
    web_apps = [a for a in entries
                if str(a.get("platform", a.get("type", ""))).upper() == "WEB"]
    if len(web_apps) != 1:
        print("P231_WEB_APP_COUNT=NOT_EXACTLY_ONE")
        sys.exit(2)
    app_id = web_apps[0].get("appId", web_apps[0].get("app_id"))
    if not isinstance(app_id, str) or not app_id or "/" in app_id:
        print("P231_WEB_APP_ID=NOT_PARSEABLE")
        sys.exit(2)
    project_number = call(["gcloud", "projects", "describe", PROJECT,
                           "--format=value(projectNumber)"])
    if not project_number.isdecimal():
        raise ValueError("Invalid project number")
    bearer = call(["gcloud", "auth", "print-access-token"])
    if not bearer:
        raise ValueError("Missing operator token")
except Exception:
    print("P231_APP_CONFIGURATION_PREREQUISITES=UNAVAILABLE")
    sys.exit(2)

print("P231_REGISTERED_WEB_APP_COUNT=1")
print("P231_WEB_APP_ID=SELECTED_IN_MEMORY_NOT_PRINTED")
print("P231_PROJECT_NUMBER=RESOLVED_NOT_PRINTED")

base = "https://firebaseappcheck.googleapis.com/v1/projects/{}/apps/{}".format(
    project_number, app_id
)
results = {}
for provider, suffix in [
    ("RECAPTCHA_ENTERPRISE", "recaptchaEnterpriseConfig"),
    ("RECAPTCHA_V3", "recaptchaV3Config"),
]:
    req = Request(base + "/" + suffix, method="GET",
                  headers={"Authorization": "Bearer " + bearer})
    try:
        with urlopen(req, timeout=15) as resp:
            obj = json.load(resp)
        # A 200 config object is only configuration metadata, not proof of
        # usable site key/attestation or successful App Check exchange.
        status = "CONFIG_RECORD_PRESENT" if isinstance(obj, dict) else "UNEXPECTED_RESPONSE"
    except HTTPError as exc:
        status = ("NOT_REGISTERED_OR_NOT_FOUND" if exc.code == 404 else
                  "NOT_AUTHORIZED" if exc.code in (401, 403) else
                  "HTTP_ERROR")
    except (URLError, ValueError, TimeoutError):
        status = "UNAVAILABLE"
    print("P231_" + provider + "_CONFIG=" + status)
    results[provider] = status

print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_FIREBASE_AUTH_TEST_USER=NOT_VERIFIED")
print("P231_E2E=NOT_PERFORMED")
print("P231_CLOUD_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
if any(x in ("NOT_AUTHORIZED", "UNAVAILABLE", "HTTP_ERROR", "UNEXPECTED_RESPONSE")
       for x in results.values()):
    print("P231_PROVIDER_READINESS=INCOMPLETE")
    sys.exit(2)
print("P231_PROVIDER_READINESS=CONFIGURATION_DISCOVERY_ONLY")
