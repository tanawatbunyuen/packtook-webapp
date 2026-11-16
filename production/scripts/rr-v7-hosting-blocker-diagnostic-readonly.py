#!/usr/bin/env python3
"""Read-only V7 Hosting check with sanitized blocker category. No credentials printed."""
import importlib.util
import pathlib
import os
import subprocess
import urllib.error
import urllib.parse

base=pathlib.Path(__file__).with_name("rr-v7-staging-hosting-parity-readonly.py")
spec=importlib.util.spec_from_file_location("v7base",base)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def kind(exc):
    if isinstance(exc,urllib.error.HTTPError):
        if exc.code==404:return "HTTP_404"
        if exc.code in (401,403):return "HTTP_ACCESS_DENIED"
        return "HTTP_OTHER"
    if isinstance(exc,urllib.error.URLError):return "NETWORK_OR_DNS"
    if isinstance(exc,subprocess.CalledProcessError):return "GCLOUD_PROJECT_CHECK"
    if isinstance(exc,FileNotFoundError):return "LOCAL_FILE_MISSING"
    if isinstance(exc,PermissionError):return "LOCAL_FILE_PERMISSIONS"
    if isinstance(exc,OSError):return "LOCAL_IO"
    if isinstance(exc,ValueError):
        allowed={"ONLY_STAGING_HOST_ALLOWED","PROJECT_GUARD","UNSAFE_ENV",
                 "ACTIVE_PROJECT_MISMATCH","REDIRECT_NOT_ALLOWED","HTTP_NOT_200",
                 "BAD_ASSET_SIZE"}
        return str(exc) if str(exc) in allowed else "VALIDATION_ERROR"
    return "UNKNOWN"

def guarded():
    current=None
    try:
        if os.environ.get("RR_STAGING_PROJECT_ID")!=mod.PROJECT:
            raise ValueError("PROJECT_GUARD")
        if any(os.environ.get(k) for k in ("OMISE_SECRET_KEY","FIREBASE_TOKEN",
                "GOOGLE_APPLICATION_CREDENTIALS","PACKTOOK_PRODUCTION_PROJECT_ID")):
            raise ValueError("UNSAFE_ENV")
        current=subprocess.check_output(
            ["gcloud","config","get-value","project"],text=True,
            stderr=subprocess.DEVNULL).strip()
        if current!=mod.PROJECT:raise ValueError("ACTIVE_PROJECT_MISMATCH")
        root=pathlib.Path(__file__).resolve().parents[2]/"firebase-staging"
        url="https://packtook-staging.web.app"
        for asset in mod.ASSETS:
            print("CHECKING_ASSET:",asset,flush=True)
            try:
                local=(root/asset).read_bytes()
                remote=mod.fetch(mod.asset_url(url,asset))
                print("STAGING_ASSET_"+asset.replace(".","_").upper()+":",
                      mod.classify(local,remote),flush=True)
                if local!=remote:
                    print("STAGING_ASSET_PARITY: BLOCKED_DRIFT")
                    return 2
            except (OSError,ValueError,urllib.error.URLError) as exc:
                print("BLOCKED_STAGE: ASSET_FETCH_OR_COMPARE")
                print("BLOCKED_ASSET:",asset)
                print("BLOCKED_REASON:",kind(exc))
                return 2
        print("STAGING_ASSET_PARITY: PASS")
        return 0
    except (OSError,ValueError,subprocess.CalledProcessError) as exc:
        print("BLOCKED_STAGE: LOCAL_GUARD")
        print("BLOCKED_REASON:",kind(exc))
        return 2
    finally:
        print("CLOUD_WRITES: 0")
        print("DEVICE_TEST_AUTHORIZED: NO")
        print("RELEASE: NO_GO_RELEASE")

if __name__=="__main__":
    raise SystemExit(guarded())
