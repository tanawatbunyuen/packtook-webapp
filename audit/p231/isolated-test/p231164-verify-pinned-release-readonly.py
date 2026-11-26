#!/usr/bin/env python3
"""P231.164: Read-only pinned rollback reference validation against current Hosting.
No mutations. Existing gcloud user credentials are held only in process memory.
Never prints token, resource payload, API error bodies, or raw file contents.
"""
import json,pathlib,re,subprocess,sys,urllib.error,urllib.request
PIN=pathlib.Path("audit/p231/isolated-test/p231164-staging-live-release-pin.json")
BASE="https://firebasehosting.googleapis.com/v1beta1/"
def out(k,v):print(f"P231_{k}={v}",flush=True)
def get(path,token):
    req=urllib.request.Request(BASE+path,method="GET",headers={
        "Authorization":"Bearer "+token,
        "Accept":"application/json",
        "User-Agent":"PACKTOOK-P231164-GET-ONLY"})
    with urllib.request.urlopen(req,timeout=20) as resp:
        if resp.status!=200:raise ValueError("response status")
        data=resp.read(1000001)
        if len(data)>1000000:raise ValueError("response size")
        return json.loads(data)
def version_name(release):
    v=release.get("version",{})
    return v.get("name","") if isinstance(v,dict) else v if isinstance(v,str) else ""
out("CHECK","STAGING_HOSTING_PIN_AND_RECOVERY_METADATA_READONLY")
try:
    d=json.loads(PIN.read_text("utf8"))
    if set(d)!={"schema_version","site","channel","release","version","release_time",
               "provenance","verification","rollback_tested","artifact_backup_created",
               "staging_deploy_authorized","production_release_authorized"}:raise ValueError("pin schema")
    if d["schema_version"]!=1 or d["site"]!="packtook-staging" or d["channel"]!="live":
        raise ValueError("site/channel scope")
    if not re.fullmatch(r"sites/packtook-staging/channels/live/releases/[A-Za-z0-9_-]+",d["release"]):
        raise ValueError("release shape")
    if not re.fullmatch(r"sites/packtook-staging/versions/[A-Za-z0-9_-]+",d["version"]):
        raise ValueError("version shape")
    if any(d[k] is not False for k in ("rollback_tested","artifact_backup_created","staging_deploy_authorized","production_release_authorized")):
        raise ValueError("unsafe pin approval flag")
    p=subprocess.run(["gcloud","auth","print-access-token"],capture_output=True,text=True,timeout=15)
    if p.returncode!=0 or len(p.stdout.strip())<20:raise ValueError("credentials unavailable")
    token=p.stdout.strip()
    channel=get("sites/packtook-staging/channels/live",token)
    release=get(d["release"],token)
    version=get(d["version"],token)
    if channel.get("name")!="sites/packtook-staging/channels/live":
        raise ValueError("channel identity")
    if release.get("name")!=d["release"] or version.get("name")!=d["version"]:
        raise ValueError("resource identity")
    curr=channel.get("release",{})
    if not isinstance(curr,dict):raise ValueError("missing channel release")
    current_release=curr.get("name","")
    current_version=version_name(curr)
    pinned_release_version=version_name(release)
    if pinned_release_version!=d["version"]:raise ValueError("release version mismatch")
    status=version.get("status","")
    if status not in ("FINALIZED","CREATED","DELETED","ABANDONED","EXPIRED","CLONING",
                      "VERSION_STATUS_UNSPECIFIED"):
        raise ValueError("unexpected version status")
    pinned_current=current_release==d["release"] and current_version==d["version"]
    finalized=status=="FINALIZED"
    out("API_RESULT","HTTP_200_3_GET")
    out("PIN_FILE_SCHEMA","VALID")
    out("PIN_RELEASE_RESOURCE_EXISTS","YES")
    out("PIN_RELEASE_TO_VERSION","MATCH")
    out("PIN_EQUALS_CURRENT_LIVE","YES" if pinned_current else "NO")
    out("PIN_VERSION_STATUS",status)
    out("PIN_VERSION_FINALIZED","YES" if finalized else "NO")
    out("PIN_TIME_MATCHES_RELEASE","YES" if d["release_time"]==release.get("releaseTime") else "NO")
    out("PIN_METADATA_VALIDATED","PASS" if pinned_current and finalized and d["release_time"]==release.get("releaseTime") else "REVIEW_REQUIRED")
    out("ROLLBACK_EXECUTION","NOT_TESTED")
    out("RECOVERY_ARTIFACT_BACKUP","NOT_CREATED")
    out("RESTORABILITY","NOT_VERIFIED")
    out("DEPLOY_APPROVAL","NOT_GRANTED")
    out("CREDENTIALS","NOT_PRINTED")
    out("API_CALLS","THREE_GET_ONLY")
    out("FILE_WRITES","0")
    out("CLOUD_WRITES","0")
    out("DEPLOY","NOT_PERFORMED")
    out("RELEASE","NO_GO")
    sys.exit(0 if pinned_current and finalized and d["release_time"]==release.get("releaseTime") else 3)
except urllib.error.HTTPError as e:
    out("API_RESULT","HTTP_"+str(e.code))
except Exception:
    out("API_RESULT","READ_OR_VALIDATION_ERROR")
out("FAILURE_DETAILS","REDACTED")
out("ROLLBACK_EXECUTION","NOT_TESTED")
out("CLOUD_WRITES","0")
out("DEPLOY","NOT_PERFORMED")
out("RELEASE","NO_GO")
sys.exit(2)
