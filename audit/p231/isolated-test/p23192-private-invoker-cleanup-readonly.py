#!/usr/bin/env python3
"""P231.92: read-only candidate invoker/cleanup permission review.
Uses Cloud Resource Manager testIamPermissions with existing gcloud credentials.
Does not invoke, deploy, change IAM, print account identities, or persist tokens.
"""
import json
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT = "packtook-staging"
TEST_PERMISSIONS = [
    "run.services.get",
    "run.services.getIamPolicy",
    "run.services.setIamPolicy",
    "run.routes.invoke",
    "cloudfunctions.functions.get",
    "cloudfunctions.functions.delete",
    "run.services.delete",
]

print("P231_CHECK=PRIVATE_INVOKER_AND_CLEANUP_READONLY", flush=True)

def run(args):
    return subprocess.check_output(
        args, text=True, stderr=subprocess.DEVNULL, timeout=20
    ).strip()

try:
    active = [a for a in run([
        "gcloud", "auth", "list", "--filter=status:ACTIVE",
        "--format=value(account)"
    ]).splitlines() if a]
    if len(active) != 1:
        print("P231_ACTIVE_OPERATOR=NOT_UNAMBIGUOUS")
        sys.exit(2)
    identity_kind = "SERVICE_ACCOUNT" if active[0].endswith(".gserviceaccount.com") else "USER_OR_FEDERATED"
    print("P231_ACTIVE_OPERATOR=ONE_ACCOUNT")
    print("P231_OPERATOR_IDENTITY_TYPE=" + identity_kind)
    project = run(["gcloud", "config", "get-value", "project"])
    if project != PROJECT:
        print("P231_ACTIVE_PROJECT=BLOCKED")
        sys.exit(2)
    print("P231_ACTIVE_PROJECT=STAGING")
    # Keep credential ephemeral in memory. Never print the token or HTTP body.
    token = run(["gcloud", "auth", "print-access-token"])
    if not token:
        raise ValueError("No operator credential")
except Exception:
    print("P231_OPERATOR_AUTH=UNAVAILABLE")
    sys.exit(2)

payload = json.dumps({"permissions": TEST_PERMISSIONS}).encode("utf-8")
req = Request(
    f"https://cloudresourcemanager.googleapis.com/v1/projects/{PROJECT}:testIamPermissions",
    data=payload,
    method="POST",
    headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    }
)
try:
    with urlopen(req, timeout=20) as response:
        allowed = set(json.load(response).get("permissions", []))
except (HTTPError, URLError, ValueError, TimeoutError):
    print("P231_PERMISSION_PROBE=UNAVAILABLE")
    allowed = set()
else:
    print("P231_PERMISSION_PROBE=READ_ONLY_COMPLETE")

for permission in TEST_PERMISSIONS:
    tag = permission.replace(".", "_").upper()
    print("P231_PERMISSION_" + tag + "=" +
          ("ALLOWED_AT_PROJECT" if permission in allowed else "NOT_ALLOWED_OR_NOT_VERIFIED"))

print("P231_OPERATOR_INVOKER_CANDIDATE=ACTIVE_OPERATOR_NOT_APPROVED")
print("P231_NEW_SERVICE_IAM=NOT_EXISTING_NOT_VERIFIED")
print("P231_SERVICE_LEVEL_INVOKER_GRANT=NOT_PERFORMED")
print("P231_CLEANUP_SCOPE=NEW_P231_FUNCTION_ONLY")
print("P231_CLEANUP_TIMEBOX=PROPOSAL_SAME_DAY_NOT_APPROVED")
print("P231_CLEANUP_DELETION=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_RUNTIME_APPCHECK=NOT_VERIFIED")
print("P231_RELEASE=NO_GO")
# This is only evidence collection. Exit 0 means the query succeeded;
# it must not be treated as approval or proof of service-level permissions.
sys.exit(0 if allowed else 2)
