#!/usr/bin/env python3
"""P231.113 read-only classify tracked App Check client code without exposing keys.
A match is not evidence of deployed browser execution or valid attestation.
"""
from pathlib import Path
import subprocess

print("P231_CHECK=APPCHECK_CLIENT_PATH_CLASSIFICATION_READONLY")
project=subprocess.run(["gcloud","config","get-value","project"],capture_output=True,text=True)
if project.returncode != 0 or project.stdout.strip() != "packtook-staging":
    print("P231_GATE=BLOCKED_ACTIVE_PROJECT");raise SystemExit(2)
root=subprocess.run(["git","rev-parse","--show-toplevel"],capture_output=True,text=True,check=True).stdout.strip()
names=subprocess.check_output(["git","-C",root,"ls-files","-z"]).split(b"\0")
needles={
    "INIT_APPCHECK":"initializeAppCheck",
    "ENTERPRISE_PROVIDER":"ReCaptchaEnterpriseProvider",
    "APPCHECK_GET_TOKEN":"getToken",
    "FIREBASE_AUTH":"getAuth(",
}
found=[]
for raw in names:
    if not raw: continue
    p=Path(raw.decode("utf-8","surrogateescape"))
    if p.suffix.lower() not in (".js",".jsx",".ts",".tsx",".html"):continue
    f=Path(root)/p
    try:
        if f.is_symlink() or not f.is_file() or f.stat().st_size > 1024*1024:continue
        s=f.read_text(encoding="utf8")
    except (UnicodeError,OSError):continue
    flags=[k for k,v in needles.items() if v in s]
    if not flags: continue
    part=p.parts
    # A tracked code file under audit/docs/tests is not a verified runtime client.
    testing=any(x.lower() in ("audit","test","tests","fixtures","docs","examples","node_modules") for x in part)
    kind="NON_RUNTIME_OR_TEST" if testing else "POTENTIAL_RUNTIME_UNVERIFIED"
    # Print path only for non-sensitive tracked files; no source lines or contents.
    print("P231_MATCH_PATH="+p.as_posix())
    print("P231_MATCH_CLASS="+kind)
    print("P231_MATCH_INDICATORS="+",".join(flags))
    found.append((kind,flags))
print("P231_MATCHED_FILES="+str(len(found)))
print("P231_POTENTIAL_RUNTIME_FILES="+str(sum(k=="POTENTIAL_RUNTIME_UNVERIFIED" for k,_ in found)))
print("P231_DEPLOYED_FRONTEND_REVISION=NOT_VERIFIED")
print("P231_REAL_BROWSER_ATTESTATION=NOT_PERFORMED")
print("P231_VALID_APPCHECK_TOKEN=NOT_MINTED")
print("P231_VERIFIED_STAGING_AUTH_USER=NOT_VERIFIED")
print("P231_CLOUD_WRITES=0")
print("P231_E2E=NOT_PERFORMED")
print("P231_RELEASE=NO_GO")
