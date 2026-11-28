#!/usr/bin/env python3
"""Read-only Cloud Functions V1/V2 metadata inventory for 8 PACKTOOK staging handlers.
Requires owner-operated gcloud auth in Cloud Shell. Never changes active project.
Calls ONLY 'gcloud functions list' and 'gcloud functions describe' for explicitly
allowlisted project/region/functions. No Firebase Admin, Firestore, Secrets, IAM,
deploy, signup, payment or data writes. No raw JSON or URLs printed.
"""
import json,subprocess,sys,re
PROJECT="packtook-staging"
REGION="asia-southeast1"
TARGETS=(
 "acceptOperatorInvite","approveDuplicateRequest","inviteOperator",
 "listDuplicateRequests","listOperators","myDuplicateRequests",
 "operatorApprovalStatus","requestDuplicate"
)
def emit(k,v):print("PACKTOOK_"+k+"="+str(v),flush=True)
def invoke(args):
 # All calls have a pinned --project, no configuration changes.
 cmd=["gcloud","functions",*args,"--project="+PROJECT,"--format=json","--quiet"]
 p=subprocess.run(cmd,capture_output=True,text=True,timeout=45,check=False)
 if p.returncode!=0:
  raise RuntimeError("GCLOUD_READ_FAILED") # NEVER dump stderr (may contain URLs)
 try:return json.loads(p.stdout)
 except json.JSONDecodeError:raise RuntimeError("UNEXPECTED_METADATA_FORMAT")
def parse_name(record):
 path=record.get("name","")
 if not isinstance(path,str):return None
 m=re.fullmatch(r"projects/([^/]+)/locations/([^/]+)/functions/([^/]+)",path)
 return (m.group(1),m.group(2),m.group(3)) if m else None
def run():
 emit("CHECK","G02_EIGHT_FUNCTIONS_METADATA_READ_ONLY")
 emit("PROJECT",PROJECT);emit("REGION_SCOPE",REGION)
 emit("AUTHORIZATION","READ_ONLY_METADATA_ONLY")
 functions=invoke(["list"])
 if not isinstance(functions,list):raise RuntimeError("LIST_FORMAT_UNEXPECTED")
 nameMap={}
 for r in functions:
  if not isinstance(r,dict):continue
  n=parse_name(r)
  if n and n[0]==PROJECT and n[2] in TARGETS:
   nameMap.setdefault(n[2],[]).append((n[1],r))
 list_count=0; active_region=0; extra_region=0; http_count=0; error_count=0
 for name in TARGETS:
  matches=nameMap.get(name,[])
  if not matches:
   emit("FUNCTION_"+name,"ABSENT_FROM_LIST")
   continue
  list_count+=1
  in_region=[record for reg,record in matches if reg==REGION]
  outside=[reg for reg,_ in matches if reg!=REGION]
  extra_region+=len(outside)
  if outside:emit("FUNCTION_"+name+"_OTHER_REGIONS",",".join(sorted(outside)))
  if not in_region:
   emit("FUNCTION_"+name,"NOT_PRESENT_IN_TARGET_REGION")
   continue
  active_region+=1
  # Describe by pinned exact allowlisted name and region, no wildcards.
  record=invoke(["describe",name,"--region="+REGION])
  if not isinstance(record,dict) or parse_name(record)!=(PROJECT,REGION,name):
   raise RuntimeError("DESCRIBE_IDENTITY_MISMATCH")
  typ=("HTTPS" if record.get("httpsTrigger") is not None or 
       record.get("serviceConfig",{}).get("uri") else
       "EVENT" if record.get("eventTrigger") else "UNKNOWN")
  if typ=="HTTPS":http_count+=1
  state=str(record.get("state") or record.get("status") or "UNKNOWN")
  env=str(record.get("environment") or "UNKNOWN")
  entry=str(record.get("buildConfig",{}).get("entryPoint") or record.get("entryPoint") or "UNSPECIFIED")
  if not re.fullmatch(r"[A-Za-z0-9_.$-]{1,128}",entry):entry="REDACTED"
  emit("FUNCTION_"+name,"PRESENT")
  emit("FUNCTION_"+name+"_REGION",REGION)
  emit("FUNCTION_"+name+"_STATE",state)
  emit("FUNCTION_"+name+"_ENVIRONMENT",env)
  emit("FUNCTION_"+name+"_TRIGGER_TYPE",typ)
  emit("FUNCTION_"+name+"_ENTRYPOINT",entry)
  emit("FUNCTION_"+name+"_RUNTIME_REVISION","NOT_CONFIRMED_BY_FUNCTIONS_METADATA")
 emit("MATCHED_NAMES_ALL_REGIONS",list_count)
 emit("MATCHED_NAMES_TARGET_REGION",active_region)
 emit("MATCHED_OTHER_REGION_RECORDS",extra_region)
 emit("HTTPS_IN_TARGET_REGION",http_count)
 emit("REMAINING_ABSENT_TARGET_REGION",len(TARGETS)-active_region)
 emit("CALLABLE_PROTOCOL","NOT_PROVEN_BY_METADATA")
 emit("APPCHECK_ENFORCEMENT","NOT_PROVEN_BY_METADATA")
 emit("SOURCE_PROVENANCE","NOT_PROVEN_BY_METADATA")
 emit("NETWORK_REQUESTS","METADATA_GET_ONLY")
 emit("CLOUD_WRITES","0");emit("DEPLOY","NOT_PERFORMED")
 emit("PUBLIC_SIGNUP","NOT_MODIFIED");emit("FULL_PUBLIC","NO_GO")
 return 0
try:
 sys.exit(run())
except (RuntimeError,subprocess.TimeoutExpired,FileNotFoundError) as e:
 emit("INVENTORY","BLOCKED_UNVERIFIED")
 emit("BLOCKER_CATEGORY",str(e) if isinstance(e,RuntimeError) else "COMMAND_OR_TIMEOUT")
 emit("CLOUD_WRITES","0");emit("DEPLOY","NOT_PERFORMED");emit("FULL_PUBLIC","NO_GO")
 sys.exit(2)
