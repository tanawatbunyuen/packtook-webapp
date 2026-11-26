#!/usr/bin/env python3
"""P231.162 — Firebase Hosting LIVE release read-only metadata check.
Uses gcloud user access token in memory (never prints it).
Only HTTP GET to exact staging site LIVE-channel releases API.
No writes, no release creation, no deployment, no IAM changes.
"""
import json,re,subprocess,sys,urllib.error,urllib.request
SITE="packtook-staging"
URL="https://firebasehosting.googleapis.com/v1beta1/sites/"+SITE+"/channels/live/releases?pageSize=5"
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
emit("CHECK","STAGING_HOSTING_LIVE_RELEASE_METADATA_READONLY")
try:
    # A gcloud minted access token is carried only in-memory and never logged.
    p=subprocess.run(["gcloud","auth","print-access-token"],capture_output=True,text=True,timeout=15)
    if p.returncode!=0:raise ValueError("gcloud credentials unavailable")
    token=p.stdout.strip()
    if not token or len(token)<20:raise ValueError("missing credential")
    request=urllib.request.Request(URL,method="GET",headers={
      "Authorization":"Bearer "+token,
      "Accept":"application/json",
      "User-Agent":"PACKTOOK-P231162-ReadOnly"})
    with urllib.request.urlopen(request,timeout=18) as resp:
      if resp.status!=200:raise ValueError("response status")
      raw=resp.read(1000001)
      if len(raw)>1000000:raise ValueError("response too large")
    data=json.loads(raw)
except urllib.error.HTTPError as e:
    emit("API_RESULT","HTTP_"+str(e.code))
    emit("ERROR_DETAIL","REDACTED")
    emit("RELEASE_PIN","NOT_CAPTURED")
    emit("CLOUD_WRITES","0")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(2)
except Exception:
    emit("API_RESULT","AUTH_OR_NETWORK_FAILED")
    emit("ERROR_DETAIL","REDACTED")
    emit("RELEASE_PIN","NOT_CAPTURED")
    emit("CLOUD_WRITES","0")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(2)
items=data.get("releases",[])
if not isinstance(items,list) or not items:
    emit("LIVE_RELEASE_METADATA","ABSENT")
    emit("RELEASE_PIN","NOT_CAPTURED")
    emit("CLOUD_WRITES","0")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(3)
def version_name(obj):
    v=obj.get("version")
    return v.get("name","") if isinstance(v,dict) else v if isinstance(v,str) else ""
release=items[0]
name=release.get("name","")
version=version_name(release)
date=release.get("releaseTime","")
# The API endpoint explicitly scopes to channels/live; ensure release is same site.
release_ok=bool(re.fullmatch(r"sites/"+SITE+r"/(?:channels/live/)?releases/[A-Za-z0-9_-]+",name))
version_ok=bool(re.fullmatch(r"sites/"+SITE+r"/versions/[A-Za-z0-9_-]+",version))
date_ok=bool(re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z",date))
emit("API_RESULT","HTTP_200")
emit("LIVE_CHANNEL_SCOPE","YES")
emit("RELEASES_RETURNED",len(items))
emit("LIVE_RELEASE_NAME_FORMAT","VALID" if release_ok else "UNEXPECTED")
emit("LIVE_VERSION_NAME_FORMAT","VALID" if version_ok else "UNEXPECTED")
emit("RELEASE_TIME_FORMAT","VALID" if date_ok else "UNEXPECTED")
if release_ok and version_ok and date_ok:
    # Release/version names are resource identifiers, NOT OAuth credentials.
    emit("CURRENT_LIVE_RELEASE_NAME",name)
    emit("CURRENT_LIVE_VERSION_NAME",version)
    emit("CURRENT_LIVE_RELEASE_TIME",date)
    emit("RELEASE_PIN","OBSERVED_READ_ONLY_NOT_PERSISTED")
else:
    emit("RELEASE_PIN","BLOCKED_UNEXPECTED_METADATA")
emit("ROLLBACK_SNAPSHOT","NOT_CREATED")
emit("ROLLBACK_PROCEDURE","NOT_VERIFIED")
emit("HOSTING_DEPLOY_GATE","BLOCKED")
emit("AUTH_TOKEN_VALUE","NOT_PRINTED")
emit("CLOUD_REQUESTS","HOSTING_LIVE_RELEASE_GET_ONLY")
emit("CLOUD_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
sys.exit(0 if release_ok and version_ok and date_ok else 3)
