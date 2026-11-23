#!/usr/bin/env python3
"""P157: bounded HEAD-only check of official Firestore emulator artifact.
No body download, no secrets, no user credentials, no Firebase CLI.
"""
import argparse
import http.client
import socket
import ssl
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

URL = "https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar"
HOST = "storage.googleapis.com"
def check(timeout=10):
    u=urlparse(URL)
    assert u.scheme=="https" and u.hostname==HOST and not u.username and not u.password
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    request=urllib.request.Request(URL,method="HEAD",headers={"User-Agent":"PACKTOOK-P157-readonly-head-probe"})
    try:
        with opener.open(request,timeout=timeout) as resp:
            code=int(resp.status)
            length=resp.headers.get("Content-Length", "")
            size=int(length) if length.isdecimal() and len(length)<15 else -1
            return code,size,"NONE"
    except urllib.error.HTTPError as e:
        return int(e.code),-1,"HTTP_ERROR"
    except urllib.error.URLError as e:
        reason=e.reason
        if isinstance(reason,socket.gaierror):cat="DNS_FAILURE"
        elif isinstance(reason,(socket.timeout,TimeoutError)):cat="TIMEOUT"
        elif isinstance(reason,ssl.SSLError):cat="TLS_FAILURE"
        elif isinstance(reason,ConnectionRefusedError):cat="CONNECT_REFUSED"
        elif isinstance(reason,OSError):cat="NETWORK_OS_ERROR"
        else:cat="URL_CONNECTION_ERROR"
        return 0,-1,cat
    except (socket.timeout,TimeoutError):
        return 0,-1,"TIMEOUT"
    except ssl.SSLError:
        return 0,-1,"TLS_FAILURE"
    except OSError:
        return 0,-1,"NETWORK_OS_ERROR"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--head-only",action="store_true")
    args=parser.parse_args()
    if not args.head_only:
        print("P157_BLOCK=EXPLICIT_HEAD_ONLY_REQUIRED");sys.exit(2)
    print("P157_MODE=OFFICIAL_ARTIFACT_HEAD_ONLY")
    print("P157_TARGET_HOST=storage.googleapis.com")
    print("P157_ARTIFACT_VERSION=1.22.0")
    print("P157_PROXY_POLICY=DISABLED_FOR_DIRECT_CONNECT_TEST")
    code,size,err=check()
    print("P157_HTTP_STATUS="+str(code))
    print("P157_CONTENT_LENGTH_BYTES="+(str(size) if size>=0 else "UNKNOWN"))
    print("P157_NETWORK_ERROR_CATEGORY="+err)
    if code==200 and size>1_000_000:result="OFFICIAL_ARTIFACT_REACHABLE_HEAD"
    elif code in (403,404):result="PROVIDER_ACCESS_OR_ARTIFACT_ERROR"
    elif code==0:result="NETWORK_PATH_FAILURE_OR_TIMEOUT"
    else:result="HEAD_RESPONSE_INCONCLUSIVE"
    print("P157_DIAGNOSTIC="+result)
    print("P157_GET_REQUESTS=0 P157_BODY_BYTES_READ=0 P157_JAR_WRITES=0")
    print("P157_FIREBASE_CLI_RUNS=0 P157_EMULATOR_STARTS=0 P157_CLOUD_DEPLOYS=0")
    print("P157_DECISION=NO_GO_UNTIL_OFFICIAL_JAR_VERIFIED_AND_AUTHZ_TESTED")
if __name__=="__main__":main()
