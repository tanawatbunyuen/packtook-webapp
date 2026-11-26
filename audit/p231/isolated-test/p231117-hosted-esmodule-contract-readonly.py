#!/usr/bin/env python3
"""P231.117 — READ ONLY hosted staging ES module import/export compatibility.
Prints only enumerated results. No source bodies, keys, tokens, credentials, or URLs.
No deploy, cloud writes, auth, browser execution, or attestation.
"""
import re
import subprocess
import sys
from urllib.request import Request, build_opener, HTTPRedirectHandler
from urllib.error import HTTPError, URLError

PROJECT="packtook-staging"
HOST="packtook-staging.web.app"
MAX_SIZE=450_000

print("P231_CHECK=HOSTED_ESMODULE_IMPORT_EXPORT_CONTRACT_READONLY",flush=True)

class RejectRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("redirect blocked")

def get(path):
    with build_opener(RejectRedirect).open(
      Request("https://"+HOST+path,method="GET",
              headers={"User-Agent":"PACKTOOK-P231-readonly"}),timeout=20
    ) as resp:
        if resp.status!=200: raise ValueError("not HTTP 200")
        if not any(t in resp.headers.get_content_type().lower()
                   for t in ("javascript","text/plain")): raise ValueError("not script")
        data=resp.read(MAX_SIZE+1)
        if len(data)>MAX_SIZE: raise ValueError("oversized response")
        return data.decode("utf-8")

try:
    project=subprocess.check_output(["gcloud","config","get-value","project"],
         text=True,stderr=subprocess.DEVNULL,timeout=15).strip()
    if project!=PROJECT:
        print("P231_GATE=BLOCKED_PROJECT");sys.exit(2)
    cfg=get("/firebase-v4-config.js")
    bridge=get("/firebase-packing-bridge.js")
except (OSError,subprocess.SubprocessError,HTTPError,URLError,ValueError,UnicodeError,TimeoutError):
    print("P231_HOSTED_SCRIPT_FETCH=BLOCKED_OR_UNEXPECTED")
    print("P231_E2E=NOT_PERFORMED")
    print("P231_RELEASE=NO_GO")
    sys.exit(2)

# Deliberately accept only straightforward static named exports/imports.
# Unknown syntax => cannot declare compatibility PASS.
imports=re.findall(r"import\s*\{([^}]+)\}\s*from\s*['\"]\./firebase-v4-config\.js(?:\?[^'\"]*)?['\"]",bridge,re.S)
import_names=set()
for group in imports:
    for member in group.split(","):
        token=member.strip().split()
        if token:
            import_names.add(token[0])
exports=set()
for group in re.findall(r"export\s+(?:const|let|var)\s+([^;]+);",cfg,re.S):
    for item in group.split(","):
        match=re.match(r"\s*([A-Za-z_$][\w$]*)\s*=",item)
        if match: exports.add(match.group(1))
for name in re.findall(r"export\s*\{([^}]+)\}",cfg,re.S):
    for member in name.split(","):
        token=member.strip().split()
        if token: exports.add(token[-1])
# Captures only simple first variable declarators; complex declaration => unknown.
mandatory={"firebaseConfig","recaptchaEnterpriseSiteKey"}
print("P231_HOSTED_CONFIG_IMPORT_DECLARATION="+("FOUND" if imports else "NOT_FOUND"))
for name,label in [("firebaseConfig","FIREBASE_CONFIG"),("recaptchaEnterpriseSiteKey","ENTERPRISE_SITE_KEY")]:
    print("P231_BRIDGE_IMPORTS_"+label+"="+("YES" if name in import_names else "NO"))
    print("P231_CONFIG_EXPORTS_"+label+"="+("YES" if name in exports else "NO"))
missing=sorted(import_names-exports)
if imports and "recaptchaEnterpriseSiteKey" in import_names and "recaptchaEnterpriseSiteKey" not in exports:
    compatibility="FAIL_MISSING_ENTERPRISE_EXPORT"
elif not imports:
    compatibility="INDETERMINATE_NO_EXPECTED_IMPORT"
elif missing:
    compatibility="FAIL_OTHER_NAMED_EXPORT"
elif mandatory.issubset(import_names) and mandatory.issubset(exports):
    compatibility="PASS_STATIC_IMPORT_EXPORT_ONLY"
else:
    compatibility="INDETERMINATE"
print("P231_HOSTED_ESMODULE_CONTRACT="+compatibility)
print("P231_BROWSER_RUNTIME_CONFIRMATION=NOT_PERFORMED")
print("P231_VALID_APP_CHECK_TOKEN=NOT_MINTED")
print("P231_E2E=NOT_PERFORMED")
print("P231_IAM_WRITES=0")
print("P231_DEPLOY=NOT_PERFORMED")
print("P231_CLEANUP=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
sys.exit(0 if compatibility in ("FAIL_MISSING_ENTERPRISE_EXPORT","PASS_STATIC_IMPORT_EXPORT_ONLY") else 2)
