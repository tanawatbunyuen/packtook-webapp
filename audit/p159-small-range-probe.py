#!/usr/bin/env python3
"""P159: inspect a single 1MiB HTTP Range GET of official emulator JAR.
No cache writes, no Firebase CLI. Categorical errors and metadata only.
"""
import argparse
import shutil
from pathlib import Path
import re
import socket
import ssl
import sys
import urllib.error
import urllib.request

URL="https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v1.22.0.jar"
EXPECTED_TOTAL=136707194
END=1048575
def probe(opener=None):
    opener=opener or urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req=urllib.request.Request(URL,headers={"Range":f"bytes=0-{END}","Accept-Encoding":"identity","User-Agent":"PACKTOOK-P159-range-only"})
    try:
        with opener.open(req,timeout=12) as response:
            status=response.status
            header=response.headers.get("Content-Range","")
            correct=(status==206 and re.fullmatch(rf"bytes 0-{END}/{EXPECTED_TOTAL}",header.strip()) is not None)
            if not correct:
                return status,0,"UNEXPECTED_STATUS_OR_CONTENT_RANGE"
            payload=response.read(END+2)
            if len(payload)!=END+1:
                return status,len(payload),"SHORT_OR_EXCESS_BODY"
            return status,len(payload),"RANGE_GET_VALID"
    except urllib.error.HTTPError as e:return e.code,0,"HTTP_ERROR"
    except urllib.error.URLError as e:
        cause=e.reason
        if isinstance(cause,socket.gaierror):kind="DNS_FAILURE"
        elif isinstance(cause,ssl.SSLError):kind="TLS_FAILURE"
        elif isinstance(cause,(socket.timeout,TimeoutError)):kind="NETWORK_TIMEOUT"
        else:kind="URL_OR_NETWORK_FAILURE"
        return 0,0,kind
    except (socket.timeout,TimeoutError):return 0,0,"NETWORK_TIMEOUT"
    except ssl.SSLError:return 0,0,"TLS_FAILURE"
    except OSError:return 0,0,"IO_OR_CONNECTION_FAILURE"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--range-only",action="store_true")
    a=parser.parse_args()
    if not a.range_only:
        print("P159_BLOCK=EXPLICIT_RANGE_ONLY_REQUIRED")
        return 2
    cache=Path.home()/".packtook-demo-emulator-home/.cache/firebase/emulators"
    if cache.is_symlink() or not cache.is_dir():
        print("P159_BLOCK=PRIVATE_CACHE_DIRECTORY_UNSAFE")
        return 2
    space=shutil.disk_usage(cache).free
    print("P159_MODE=ONE_PUBLIC_HTTP_RANGE_GET_ONLY")
    print("P159_REQUESTED_BYTES=1048576")
    print("P159_EXPECTED_TOTAL_BYTES="+str(EXPECTED_TOTAL))
    print("P159_CACHE_FREE_SPACE_AT_LEAST_500MB="+str(space>=500_000_000).upper())
    status,read,category=probe()
    print("P159_HTTP_STATUS="+str(status))
    print("P159_RECEIVED_BYTES="+str(read))
    print("P159_DIAGNOSTIC="+category)
    print("P159_NO_RESPONSE_HEADERS_OR_URLS_PRINTED=TRUE")
    print("P159_JAR_FILE_WRITES=0 P159_FIREBASE_CLI_RUNS=0 P159_EMULATOR_STARTS=0 P159_DEPLOYS=0")
    print("P159_DECISION="+("SMALL_GET_VERIFIED_FULL_DOWNLOAD_UNTESTED" if category=="RANGE_GET_VALID" else "NO_GO_DOWNLOAD_NETWORK_PATH_UNCONFIRMED"))
    return 0 if category=="RANGE_GET_VALID" else 1
if __name__=="__main__":
    try:sys.exit(main())
    except Exception:
        print("P159_BLOCK=UNEXPECTED_LOCAL_FAILURE")
        sys.exit(1)
