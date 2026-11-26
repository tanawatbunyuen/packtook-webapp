#!/usr/bin/env python3
"""P231.89: read-only testIamPermissions for active operator.
No token, principal or personal identifiers are printed/stored.
No IAM policy modifications, invocations, or deployments.
"""
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT = "packtook-staging"
SA = "p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com"
PROJECT_PERMISSIONS = [
    "cloudfunctions.functions.create",
    "cloudfunctions.functions.get",
    "cloudfunctions.functions.list",
    "cloudfunctions.functions.update",
    "run.services.create",
    "run.services.get",
    "cloudbuild.builds.create",
]
SA_PERMISSIONS = ["iam.serviceAccounts.actAs"]

print("P231_CHECK=EFFECTIVE_IAM_TEST_PERMISSIONS_READONLY", flush=True)
try:
    accounts = subprocess.check_output([
        "gcloud", "auth", "list", "--filter=status:ACTIVE",
        "--format=value(account)"
    ], text=True, stderr=subprocess.DEVNULL).strip().splitlines()
    if len([a for a in accounts if a.strip()]) != 1:
        print("P231_ACTIVE_OPERATOR=BLOCKED_NOT_ONE")
        sys.exit(2)
    project = subprocess.check_output([
        "gcloud", "config", "get-value", "project"
    ], text=True, stderr=subprocess.DEVNULL).strip()
    if project != PROJECT:
        print("P231_GCLOUD_ACTIVE_PROJECT=BLOCKED_NOT_STAGING")
        sys.exit(2)
    token = subprocess.check_output([
        "gcloud", "auth", "print-access-token"
    ], stderr=subprocess.DEVNULL).decode().strip()
    if not token:
        raise RuntimeError("no access token")
except Exception:
    print("P231_OPERATOR_AUTH=BLOCKED")
    sys.exit(2)

def test_permissions(label, url, requested):
    payload = json.dumps({"permissions": requested}).encode("utf-8")
    req = Request(url, data=payload, method="POST", headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    })
    try:
        with urlopen(req, timeout=20) as res:
            result = json.load(res)
        allowed = set(result.get("permissions", []))
        for perm in requested:
            tag = perm.replace(".", "_").upper()
            print(f"P231_{label}_{tag}=" + ("ALLOWED" if perm in allowed else "NOT_GRANTED_OR_DENIED"))
        return set(requested).issubset(allowed)
    except (HTTPError, URLError, ValueError, TimeoutError):
        print(f"P231_{label}_PERMISSION_CHECK=UNAVAILABLE")
        return False

project_ok = test_permissions(
    "PROJECT",
    f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}:testIamPermissions",
    PROJECT_PERMISSIONS
)
sa_ok = test_permissions(
    "RUNTIME_SA",
    f"https://iam.googleapis.com/v1/projects/-/serviceAccounts/{SA}:testIamPermissions",
    SA_PERMISSIONS
)
print("P231_EFFECTIVE_DEPLOY_CAPABILITY=" + ("PARTIAL_REQUIRED_CHECKS_PASS" if project_ok else "NOT_VERIFIED_OR_DENIED"))
print("P231_OPERATOR_ACT_AS=" + ("PASS_TEST_IAM_PERMISSIONS" if sa_ok else "NOT_VERIFIED_OR_DENIED"))
print("P231_INVOKER_IDENTITY=NOT_SELECTED")
print("P231_PRIVATE_SERVICE_IAM=NOT_CONFIGURED")
print("P231_CLEANUP=DOCUMENTED_NOT_APPROVED")
print("P231_CLOUD_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_RUNTIME_APPCHECK=NOT_VERIFIED")
print("P231_RELEASE=NO_GO")
# Success means only these specific IAM permissions are confirmed, not every
# dependency of Firebase CLI deploy and not future service-level IAM.
sys.exit(0 if project_ok and sa_ok else 2)
