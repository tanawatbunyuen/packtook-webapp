#!/usr/bin/env python3
"""PACKTOOK V7 non-mutating Staging Hosting deployment drift check.
Default URL is the Staging project's default Hosting site. Never accesses Auth,
Firestore, Cloud Run, Omise, camera, or file contents. No deploy.
"""
import argparse
import hashlib
import os
import pathlib
import subprocess
import urllib.error
import urllib.parse
import urllib.request

PROJECT="packtook-staging"
ALLOWED_HOSTS=frozenset({"packtook-staging.web.app","packtook-staging.firebaseapp.com"})
ASSETS=("index.html","app.js","firebase-packing-bridge.js",
        "video-stream-writer.js","video-history-db.js")
MAX_BYTES=2_000_000
class DenyRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        raise ValueError("REDIRECT_NOT_ALLOWED")

def fetch(url, opener=None):
    op=opener or urllib.request.build_opener(DenyRedirect)
    with op.open(urllib.request.Request(
       url,headers={"Accept":"text/html,application/javascript,*/*"},method="GET"),
       timeout=15) as res:
        if res.status!=200:raise ValueError("HTTP_NOT_200")
        body=res.read(MAX_BYTES+1)
    if not body or len(body)>MAX_BYTES:raise ValueError("BAD_ASSET_SIZE")
    return body

def classify(local,remote):
    if local==remote:return "MATCH"
    return "DRIFT"

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--url",default="https://packtook-staging.web.app")
    args=parser.parse_args()
    url=urllib.parse.urlparse(args.url)
    if url.scheme!="https" or url.hostname not in ALLOWED_HOSTS or url.port or url.username or url.password or url.path not in ("","/") or url.query or url.fragment:
        raise ValueError("ONLY_STAGING_HOST_ALLOWED")
    if os.environ.get("RR_STAGING_PROJECT_ID")!=PROJECT:raise ValueError("PROJECT_GUARD")
    if any(os.environ.get(k) for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
        raise ValueError("UNSAFE_ENV")
    current=subprocess.check_output(["gcloud","config","get-value","project"],text=True,stderr=subprocess.DEVNULL).strip()
    if current!=PROJECT:raise ValueError("ACTIVE_PROJECT_MISMATCH")
    root=pathlib.Path(__file__).resolve().parents[2]/"firebase-staging"
    results={}
    for asset in ASSETS:
        local=(root/asset).read_bytes()
        remote=fetch(args.url.rstrip("/")+"/"+asset)
        results[asset]=classify(local,remote)
    for name,result in results.items():
        print("STAGING_HOSTING_ASSET_"+name.replace(".","_").upper()+":",result)
    match=all(v=="MATCH" for v in results.values())
    print("STAGING_ASSET_PARITY:", "PASS" if match else "BLOCKED_DRIFT")
    print("CLOUD_WRITES: 0")
    print("DEVICE_TEST_AUTHORIZED: NO")
    print("RELEASE: NO_GO_RELEASE")
    if not match:raise SystemExit(2)
if __name__=="__main__":
    try:main()
    except (ValueError,OSError,urllib.error.URLError,subprocess.CalledProcessError):
        raise SystemExit("V7_STAGING_HOSTING_PREFLIGHT: BLOCKED")
