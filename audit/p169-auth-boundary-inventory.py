#!/usr/bin/env python3
"""P169 local read-only Firebase emulator authentication-boundary inventory.

Never imports functions/index.js, starts emulator, creates users, uses credentials,
contacts Firebase Cloud, installs dependencies, or deploys. Versions printed
only when strictly validated. Runtime protocol remains NO_GO.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/"functions/index.js"
P168=ROOT/"audit/p168-callable-http.py"
PACKAGE=ROOT/"functions/package.json"
EXPECTED_SOURCE="92262ea2fbbb941188937d72f0eea74a735d2bf3"
VERSION=re.compile(r"^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][A-Za-z0-9_.-]+)?$")
NODE_VERSION=re.compile(r"^v?[0-9]+(?:\.[0-9]+){1,3}(?:[-+][A-Za-z0-9_.-]+)?$")

def git_blob(content):
    return hashlib.sha1(b"blob "+str(len(content)).encode()+b"\0"+content).hexdigest()

def triage(record):
    """Separate local denial, handler reachability and protocol conformance."""
    http=record.get("http")
    error=record.get("status")
    entered=record.get("handler_entered")
    reads=record.get("db_reads_unchanged")
    safe_denial=(http in (401,403) and error in
        ("UNAUTHENTICATED","PERMISSION_DENIED") and reads is True)
    protocol=(http==401 and error=="UNAUTHENTICATED")
    # Handler-entry is a separate observed boundary, NOT evidence of JWT verification.
    return {
        "security_denial":safe_denial,
        "protocol_conformant":protocol,
        "handler_entered":entered,
        "authenticity_verified":False,
        "production_attested":False,
    }

def safe_run(argv,pattern):
    try:
        env=dict(os.environ)
        env["FIREBASE_SKIP_UPDATE_CHECK"]="1"
        env["CI"]="true"
        p=subprocess.run(argv,capture_output=True,text=True,timeout=12,
                         check=False,env=env)
    except (OSError,subprocess.TimeoutExpired):
        return "UNAVAILABLE"
    value=p.stdout.strip()
    if p.returncode!=0 or not pattern.fullmatch(value):
        return "UNAVAILABLE"
    return value

def sdk_package_location():
    # P168 operator installed SDK packages in its separate worktree. Reuse only
    # if the same exact pinned backend source is present there.
    if (ROOT/"functions/node_modules").is_dir():
        return PACKAGE,"CURRENT_P169_WORKTREE"
    sibling=Path.home()/"packtook-p168"/"functions"
    try:
        if ((sibling/"node_modules").is_dir()
            and git_blob((sibling/"index.js").read_bytes())==EXPECTED_SOURCE):
            return sibling/"package.json","PINNED_P168_WORKTREE"
    except OSError:
        pass
    return PACKAGE,"NOT_FOUND"

def local_packages(package_path):
    """Only installed module metadata through Node's module resolution."""
    script=r'''
const {createRequire}=require("node:module");
const fs=require("node:fs");
const path=require("node:path");
const r=createRequire(process.argv[1]);
const names=["firebase-functions","firebase-admin"];
const out={};
for(const name of names){
 try {
   let start=path.dirname(r.resolve(name));
   let found=false;
   for(let i=0;i<9;i++){
     const f=path.join(start,"package.json");
     if(fs.existsSync(f)){
       const value=JSON.parse(fs.readFileSync(f,"utf8"));
       if(value.name===name && typeof value.version==="string"){
         out[name]=value.version;found=true;break;
       }
     }
     const up=path.dirname(start);
     if(up===start)break;
     start=up;
   }
   if(!found)out[name]=null;
 }catch(_){out[name]=null;}
}
process.stdout.write(JSON.stringify(out));
'''
    try:
        p=subprocess.run(["node","-e",script,str(package_path)],
            capture_output=True,text=True,timeout=12)
        if p.returncode!=0:return {}
        data=json.loads(p.stdout)
        if not isinstance(data,dict):return {}
        return data
    except (OSError,subprocess.TimeoutExpired,ValueError):
        return {}

def main():
    print("P169_MODE=READ_ONLY_LOCAL_VERSION_AND_AUTH_BOUNDARY_INVENTORY")
    try:
        data=SOURCE.read_bytes()
        config=json.loads(PACKAGE.read_text())
        p168=P168.read_text()
    except (OSError,ValueError):
        print("P169_BLOCK=LOCAL_SOURCE_UNAVAILABLE")
        return 1
    if git_blob(data)!=EXPECTED_SOURCE:
        print("P169_BLOCK=SOURCE_DRIFT")
        return 1
    if (config.get("dependencies",{}).get("firebase-functions")!="^6.0.0"
        or config.get("dependencies",{}).get("firebase-admin")!="^13.0.0"):
        print("P169_BLOCK=DECLARED_DEPENDENCY_DRIFT")
        return 1
    if ("INVALID_TOKEN_HANDLER_ENTERED" not in p168
        or "dbEventMarker" not in p168
        or 'REGION = "asia-southeast1"' not in p168):
        print("P169_BLOCK=P168_DIAGNOSTIC_SOURCE_DRIFT")
        return 1
    print("P169_PINNED_BACKEND_SOURCE=PASS")
    print("P169_P168_DIAGNOSTIC_GATE=PASS")
    firebase=shutil.which("firebase")
    node=shutil.which("node")
    print("P169_FIREBASE_CLI_VERSION="+
        (safe_run([firebase,"--version"],VERSION) if firebase else "UNAVAILABLE"))
    print("P169_NODE_VERSION="+
        (safe_run([node,"--version"],NODE_VERSION) if node else "UNAVAILABLE"))
    sdk_package, sdk_location=sdk_package_location()
    print("P169_INSTALLED_SDK_SOURCE="+sdk_location)
    pkgs=local_packages(sdk_package) if node else {}
    for name,tag in (("firebase-functions","FUNCTIONS"),("firebase-admin","ADMIN")):
        val=pkgs.get(name)
        print("P169_INSTALLED_"+tag+"_SDK_VERSION="+
            (val if isinstance(val,str) and VERSION.fullmatch(val) else "UNAVAILABLE"))
    print("P169_DECLARED_FUNCTIONS_SDK_RANGE=6.x")
    print("P169_DECLARED_ADMIN_SDK_RANGE=13.x")
    observed={"http":403,"status":"PERMISSION_DENIED",
              "handler_entered":True,"db_reads_unchanged":True}
    result=triage(observed)
    assert result["security_denial"] is True
    assert result["protocol_conformant"] is False
    assert result["handler_entered"] is True
    assert result["authenticity_verified"] is False
    print("P169_OPERATOR_OBSERVED_INVALID_TOKEN_SECURITY_DENIED=PASS")
    print("P169_OPERATOR_OBSERVED_INVALID_TOKEN_HANDLER_ENTERED=TRUE")
    print("P169_OPERATOR_OBSERVED_INVALID_TOKEN_PROTOCOL_CONFORMANT=FALSE")
    print("P169_CRYPTOGRAPHIC_TOKEN_VERIFICATION_ATTESTED=FALSE")
    print("P169_RUNTIME_EXECUTION=0 P169_CLOUD_CALLS=0 P169_DEPLOYS=0")
    print("P169_DECISION=EMULATOR_AUTH_BOUNDARY_REVIEWED_PROTOCOL_NO_GO")
    return 0

if __name__=="__main__":
    try:sys.exit(main())
    except Exception:
        print("P169_BLOCK=LOCAL_INVENTORY_EXCEPTION")
        print("P169_DECISION=NO_GO_VERSION_REVIEW_INCOMPLETE")
        sys.exit(1)
