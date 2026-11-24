#!/usr/bin/env python3
"""P164: negative-only local client write / unmapped-read tests for P163 rules candidate.

Uses P163's isolated launcher & exact-blob checks. Never invokes cloud endpoints.
All attempted Firestore writes MUST be HTTP 403; do not use for real data.
"""
import importlib.util
import json
from pathlib import Path
import secrets
import sys
import urllib.error
import urllib.request

BASE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("p163_local",BASE/"p163-source-rules-isolation.py")
p=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
PROBE_DOC="p164_nonexistent"
PATHS=("", f"recordings/{PROBE_DOC}", f"audit/{PROBE_DOC}")
UNMAPPED=("unmapped/p164","accounts/_unknown_/unknownSubcollection/p164","public/p164")
def path_for(uid,suffix):
    return f"accounts/{uid}" + (("/"+suffix) if suffix else "")
def read_path(full_path,token=None):
    return p.http(p.PORTS["firestore"],
        f"/v1/projects/{p.PROJECT}/databases/(default)/documents/{full_path}",
        token=token)[0]
def client_commit(full_path,token=None):
    # This is intentionally a real Firestore REST commit request to local emulator.
    # If a write unexpectedly succeeds, fail closed and alert without printing data.
    url=(f"http://{p.HOST}:{p.PORTS['firestore']}"
         f"/v1/projects/{p.PROJECT}/databases/(default)/documents:commit")
    document=(f"projects/{p.PROJECT}/databases/(default)/documents/{full_path}")
    payload={"writes":[{"update":{
        "name":document,
        "fields":{"p164Probe":{"stringValue":"synthetic-local-only"}}}}]}
    headers={"Content-Type":"application/json"}
    if token:
        headers["Authorization"]="Bearer "+token
    req=urllib.request.Request(url,method="POST",
              headers=headers,data=json.dumps(payload).encode())
    try:
        with urllib.request.urlopen(req,timeout=5) as resp:
            resp.read(4096)
            return resp.status
    except urllib.error.HTTPError as e:
        e.close()
        return e.code
    except (urllib.error.URLError,OSError,TimeoutError):
        return 0
def verify_p164():
    print("P164_MODE=ISOLATED_LOCAL_NEGATIVE_WRITES_ONLY")
    created=[]
    ok=True
    cleanup_ok=True
    successful_writes=0
    try:
        users=[]
        for i in range(2):
            email="p164-"+secrets.token_hex(12)+"@example.invalid"
            password=secrets.token_urlsafe(24)
            code,account=p.auth("signUp",{"email":email,"password":password,"returnSecureToken":True})
            passed=p.token_valid(code,account)
            print(f"P164_ACCOUNT_{i+1}_SIGNUP="+("PASS" if passed else "FAIL"))
            if not passed:
                ok=False
                break
            created.append(account["idToken"])
            code,login=p.auth("signInWithPassword",{"email":email,"password":password,"returnSecureToken":True})
            passed=p.token_valid(code,login) and login["localId"]==account["localId"]
            print(f"P164_ACCOUNT_{i+1}_LOGIN="+("PASS" if passed else "FAIL"))
            if not passed:
                ok=False
                break
            users.append(login)
        if len(users)==2:
            distinct=users[0]["localId"]!=users[1]["localId"]
            print("P164_DISTINCT_ACCOUNT_IDS="+("PASS" if distinct else "FAIL"))
            ok=ok and distinct
            for idx,actor in enumerate(users):
                target_uid=actor["localId"]
                other_uid=users[1-idx]["localId"]
                for role,target,token in (
                    ("OWN",target_uid,actor["idToken"]),
                    ("OTHER",other_uid,actor["idToken"]),
                    ("ANONYMOUS",target_uid,None)):
                    for j,suffix in enumerate(PATHS):
                        code=client_commit(path_for(target,suffix),token)
                        passed=(code==403)
                        successful_writes+= int(code in (200,201))
                        print(f"P164_ACCOUNT_{idx+1}_{role}_WRITE_PATH_{j+1}="+
                              ("PASS" if passed else "FAIL"))
                        ok=ok and passed
                for j,full_path in enumerate(UNMAPPED):
                    code=read_path(full_path,actor["idToken"])
                    passed=code==403
                    print(f"P164_ACCOUNT_{idx+1}_UNMAPPED_READ_{j+1}="+
                          ("PASS" if passed else "FAIL"))
                    ok=ok and passed
            for j,full_path in enumerate(UNMAPPED):
                code=read_path(full_path)
                passed=code==403
                print(f"P164_ANONYMOUS_UNMAPPED_READ_{j+1}="+
                      ("PASS" if passed else "FAIL"))
                ok=ok and passed
    finally:
        for token in reversed(created):
            code,_=p.auth("delete",{"idToken":token})
            cleanup_ok=cleanup_ok and code==200
        print("P164_DISPOSABLE_AUTH_CLEANUP="+("PASS" if cleanup_ok else "FAIL"))
        print("P164_SUCCESSFUL_CLIENT_WRITES="+str(successful_writes))
        print("P164_NO_OWNER_IMPORTS=TRUE P164_NO_DEPLOYS=TRUE")
        print("P164_PRODUCTION_RULES_ATTESTED=FALSE")
        decision=("LOCAL_SOURCE_RULES_WRITE_DENIAL_ATTESTED"
                  if ok and cleanup_ok and successful_writes==0
                  else "NO_GO_CLIENT_SECURITY_INCOMPLETE")
        print("P164_DECISION="+decision)
    return ok and cleanup_ok and successful_writes==0

if __name__=="__main__":
    # Reuse P163's separately isolated process lifecycle, private log, and blob validation.
    p.verify=verify_p164
    try:
        sys.exit(p.main())
    except Exception:
        print("P164_BLOCK=LOCAL_SECURITY_TEST_ERROR")
        print("P164_DECISION=NO_GO_CLIENT_SECURITY_INCOMPLETE")
        sys.exit(1)
