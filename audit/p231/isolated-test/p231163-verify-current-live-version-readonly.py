#!/usr/bin/env python3
"""P231.163: verify P231.162 release against the live channel current release
and its Firebase Hosting version metadata. GET-only; no files or cloud writes.
"""
import json,re,subprocess,sys,urllib.error,urllib.request
BASE="https://firebasehosting.googleapis.com/v1beta1/"
SITE="packtook-staging"
PIN_RELEASE="sites/packtook-staging/channels/live/releases/1794125129869000"
PIN_VERSION="sites/packtook-staging/versions/840e12c0c88d8c1c"
def out(k,v):print(f"P231_{k}={v}",flush=True)
def get(name,token):
 req=urllib.request.Request(BASE+name,method="GET",headers={
   "Authorization":"Bearer "+token,"Accept":"application/json",
   "User-Agent":"PACKTOOK-P231163-GET-ONLY"})
 with urllib.request.urlopen(req,timeout=20) as resp:
  if resp.status!=200:raise ValueError("unexpected response")
  data=resp.read(1000001)
  if len(data)>1000000:raise ValueError("oversize")
  return json.loads(data)
def versionname(obj):
 v=obj.get("version",{})
 return v.get("name","") if isinstance(v,dict) else v if isinstance(v,str) else ""
out("CHECK","HOSTING_STAGING_LIVE_RELEASE_VERSION_VERIFICATION_READONLY")
try:
 p=subprocess.run(["gcloud","auth","print-access-token"],capture_output=True,text=True,timeout=15)
 if p.returncode!=0 or len(p.stdout.strip())<20:raise ValueError("auth")
 token=p.stdout.strip()
 channel=get("sites/"+SITE+"/channels/live",token)
 current=channel.get("release",{})
 if not isinstance(current,dict):raise ValueError("missing release")
 cn=current.get("name","")
 cv=versionname(current)
 channel_name=channel.get("name","")
 if channel_name!="sites/"+SITE+"/channels/live":raise ValueError("channel identity mismatch")
 if not re.fullmatch(r"sites/"+SITE+r"/channels/live/releases/[A-Za-z0-9_-]+",cn):
  raise ValueError("current release format")
 if not re.fullmatch(r"sites/"+SITE+r"/versions/[A-Za-z0-9_-]+",cv):
  raise ValueError("current version format")
 observed_is_current=(cn==PIN_RELEASE and cv==PIN_VERSION)
 vdata=get(cv,token)
 vname=vdata.get("name","")
 status=vdata.get("status","")
 if vname!=cv:raise ValueError("version identity")
 if status not in ("CREATED","FINALIZED","DELETED","ABANDONED","EXPIRED","CLONING","VERSION_STATUS_UNSPECIFIED"):
  raise ValueError("unrecognized status")
 out("API_RESULT","HTTP_200_BOTH")
 out("LIVE_CHANNEL_IDENTITY","VALID")
 out("P231162_PIN_EQUALS_CURRENT_LIVE_RELEASE","YES" if cn==PIN_RELEASE else "NO")
 out("P231162_PIN_EQUALS_CURRENT_LIVE_VERSION","YES" if cv==PIN_VERSION else "NO")
 out("CURRENT_LIVE_VERSION_STATUS",status)
 out("CURRENT_LIVE_VERSION_FINALIZED","YES" if status=="FINALIZED" else "NO")
 out("CURRENT_LIVE_VERSION_FILE_COUNT_PRESENT","YES" if str(vdata.get("fileCount","")).isdigit() else "NO")
 out("CURRENT_LIVE_VERSION_BYTES_PRESENT","YES" if str(vdata.get("versionBytes","")).isdigit() else "NO")
 out("RELEASE_CURRENT_VERIFICATION","PASS" if observed_is_current else "DRIFT_SINCE_P231162")
 out("ROLLBACK_VERSION_RETAINED","METADATA_ONLY_NOT_RESTORABILITY_PROOF")
 out("ROLLBACK_PROCEDURE","NOT_EXECUTED_OR_VERIFIED")
 out("RELEASE_PIN_PERSISTED","NO")
 out("AUTH_TOKEN_VALUE","NOT_PRINTED")
 out("CLOUD_REQUESTS","TWO_HOSTING_METADATA_GET_ONLY")
 out("CLOUD_WRITES","0")
 out("DEPLOY","NOT_PERFORMED")
 out("RELEASE","NO_GO")
 sys.exit(0 if observed_is_current and status=="FINALIZED" else 3)
except urllib.error.HTTPError as e:
 out("API_RESULT","HTTP_"+str(e.code))
except Exception:
 out("API_RESULT","READ_OR_VALIDATION_ERROR")
out("ERROR_DETAILS","REDACTED")
out("ROLLBACK_PROCEDURE","NOT_VERIFIED")
out("CLOUD_WRITES","0")
out("DEPLOY","NOT_PERFORMED")
out("RELEASE","NO_GO")
sys.exit(2)
