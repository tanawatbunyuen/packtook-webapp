#!/usr/bin/env python3
"""P161: read-only local Firebase Emulator hub and Firestore deny-all attestation.
Never print returned response bodies, user data, URLs, or credentials.
"""
import json,urllib.request,urllib.error,sys,socket
PROJECT="demo-packtook-owner-security"
PORTS={"hub":14400,"firestore":18080,"auth":19099}
BASE="http://127.0.0.1"
def get(url):
    req=urllib.request.Request(url,method="GET")
    try:
        with urllib.request.urlopen(req,timeout=4) as r:
            return r.status,r.read(65536)
    except urllib.error.HTTPError as e:
        return e.code,b""
    except (urllib.error.URLError,TimeoutError,OSError):
        return 0,b""
def check():
    status,body=get(f"{BASE}:14400/emulators")
    print("P161_HUB_HTTP_STATUS="+str(status))
    if status!=200:
        print("P161_BLOCK=HUB_UNREACHABLE");return 1
    try:
        data=json.loads(body)
        if not isinstance(data,dict):raise ValueError()
    except (ValueError,UnicodeError):
        print("P161_BLOCK=HUB_RESPONSE_NOT_JSON_OBJECT");return 1
    good=True
    for name,port in PORTS.items():
        item=data.get(name)
        passed=(isinstance(item,dict)
                and item.get("host")=="127.0.0.1"
                and item.get("port")==port
                and len(item.get("listen",[]))>0
                and all(x.get("address")=="127.0.0.1" and x.get("family")=="IPv4" for x in item["listen"]))
        print(f"P161_{name.upper()}_REGISTERED_IPV4="+("PASS" if passed else "FAIL"))
        good=good and passed
    no_functions="functions" not in data
    print("P161_FUNCTIONS_EMULATOR_ABSENT="+str(no_functions).upper())
    good=good and no_functions
    # This is a client-facing GET to a nonexistent document, no data modification.
    # Permission-denied should win over not-found when deny-all Firestore rules are loaded.
    path=f"/v1/projects/{PROJECT}/databases/(default)/documents/p161_unauthed_readonly_probe/nonexistent"
    code,_=get(f"{BASE}:18080"+path)
    print("P161_FIRESTORE_UNAUTHENTICATED_GET_HTTP="+str(code))
    denied=code==403
    print("P161_FIRESTORE_DENY_ALL_CLIENT_READ="+("PASS" if denied else "NOT_ATTESTED"))
    good=good and denied
    print("P161_NO_AUTH_ACCOUNT_READS_OR_WRITES=TRUE")
    print("P161_NO_FIRESTORE_WRITES=TRUE P161_NO_CLOUD_CALLS=TRUE P161_NO_DEPLOYS=TRUE")
    print("P161_OWNER_AUTHORIZATION_TESTED=FALSE")
    print("P161_DECISION="+("LOCAL_IDENTITY_AND_READ_DENIAL_ATTESTED" if good else "NO_GO_LOCAL_ATTESTATION_INCOMPLETE"))
    return 0 if good else 1
if __name__=="__main__":
    try:
        sys.exit(check())
    except Exception:
        print("P161_BLOCK=LOCAL_ATTESTATION_ERROR")
        sys.exit(1)
