#!/usr/bin/env python3
"""V7 Staging Hosting drift triage; GET-only, no deploy, no PII or raw page output.

Examines ALL five public assets, not only index.html. SHA-256 prefixes are
diagnostic fingerprints, not authorization. Never auto-synchronizes files.
"""
import hashlib
import importlib.util
import os
import pathlib
import subprocess
import urllib.error
import urllib.parse

BASE = pathlib.Path(__file__).with_name("rr-v7-staging-hosting-parity-readonly.py")
spec=importlib.util.spec_from_file_location("v7parity",BASE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

ASSET_MARKERS={
 "index.html": (b"PACKTOOK",b"firebase-packing-bridge.js",b"app.js"),
 "app.js": (b"PACKTOOK_FIREBASE",b"MediaRecorder",b"startRecording"),
 "firebase-packing-bridge.js": (b"PACKTOOK_FIREBASE",b"reserveCredit",b"finalizeCredit"),
 "video-stream-writer.js": (b"PACKTOOK_VIDEO_WRITER",),
 "video-history-db.js": (b"PACKTOOK_VIDEO_HISTORY",),
}
def safe_fingerprint(data):
    return hashlib.sha256(data).hexdigest()[:12]

def classify_asset(asset, local, remote):
    markers=ASSET_MARKERS[asset]
    if local==remote:return "MATCH"
    if all(marker in remote for marker in markers):return "DIFFERENT_PACKTOOK_BUILD"
    if asset=="index.html" and b"<html" in remote.lower():
        return "UNEXPECTED_HTML_PAGE"
    return "UNEXPECTED_CONTENT"

def verify_env():
    if os.environ.get("RR_STAGING_PROJECT_ID")!=mod.PROJECT:
        raise ValueError("PROJECT_GUARD")
    if any(os.environ.get(k) for k in (
        "OMISE_SECRET_KEY","FIREBASE_TOKEN","GOOGLE_APPLICATION_CREDENTIALS",
        "PACKTOOK_PRODUCTION_PROJECT_ID")):
        raise ValueError("UNSAFE_ENV")
    current=subprocess.check_output(
        ["gcloud","config","get-value","project"],text=True,
        stderr=subprocess.DEVNULL).strip()
    if current!=mod.PROJECT:raise ValueError("PROJECT_MISMATCH")

def run():
    status="BLOCKED"
    try:
        verify_env()
        root=pathlib.Path(__file__).resolve().parents[2]/"firebase-staging"
        site="https://packtook-staging.web.app"
        statuses=[]
        for name in mod.ASSETS:
            try:
                local=(root/name).read_bytes()
                remote=mod.fetch(mod.asset_url(site,name))
                result=classify_asset(name,local,remote)
                print("ASSET:",name)
                print("STATUS:",result)
                print("SOURCE_SHA256_PREFIX:",safe_fingerprint(local))
                print("HOSTING_SHA256_PREFIX:",safe_fingerprint(remote))
                print("SOURCE_BYTES:",len(local))
                print("HOSTING_BYTES:",len(remote))
                statuses.append(result)
            except (OSError,ValueError,urllib.error.URLError) as exc:
                print("ASSET:",name)
                print("STATUS: FETCH_BLOCKED")
                # Error category only; never print URL, token, or raw HTTP body
                if isinstance(exc,urllib.error.HTTPError):
                    why=("HTTP_404" if exc.code==404 else
                         "HTTP_DENIED" if exc.code in (401,403) else "HTTP_ERROR")
                elif isinstance(exc,urllib.error.URLError):why="NETWORK_ERROR"
                elif isinstance(exc,FileNotFoundError):why="LOCAL_FILE_MISSING"
                elif isinstance(exc,ValueError):why="REDIRECT_OR_VALIDATION"
                else:why="LOCAL_IO"
                print("REASON:",why)
                statuses.append("FETCH_BLOCKED")
        status="PASS" if len(statuses)==len(mod.ASSETS) and all(x=="MATCH" for x in statuses) else "BLOCKED_DRIFT"
    except (OSError,ValueError,subprocess.CalledProcessError):
        print("ENVIRONMENT: BLOCKED")
        status="BLOCKED"
    finally:
        print("V7_STAGING_HOSTING_PARITY:",status)
        print("CLOUD_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")
    return 0 if status=="PASS" else 2

if __name__=="__main__":
    raise SystemExit(run())
