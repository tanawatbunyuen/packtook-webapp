#!/usr/bin/env python3
"""Hermetic P93C failure classification, never calls actual gcloud."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p93c-registry-failure-readonly.py")
spec=importlib.util.spec_from_file_location("p93c",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SHA="a"*64
IMAGE="asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/recordingstatus@sha256:"+SHA
def function(n):
 return {"state":"ACTIVE","environment":"GEN_2",
   "serviceConfig":{"service":f"projects/packtook-staging/locations/asia-southeast1/services/{n.lower()}",
                    "revision":n.lower()+"-00001-abc"}}
def revision(name):
 return {"metadata":{"name":name},"spec":{"containers":[{"image":IMAGE}]}}
calls=[]
def good(args):
 calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:return json.dumps(function(args[3]))
 if args[:3]==["gcloud","run","revisions"]:return json.dumps(revision("recordingstatus-00001-abc"))
 if args[:5]==["gcloud","artifacts","docker","images","describe"]:
  assert args[-1]=="--format=value(image_summary.digest)"
  return "sha256:"+SHA
 raise AssertionError(args)
assert m.registry_check(IMAGE,good)=="DIGEST_METADATA_MATCHED_ONLY"
assert m.registry_check("gcr.io/packtook-staging/x@sha256:"+SHA,good)=="IMAGE_REFERENCE_OUTSIDE_STAGING_ALLOWLIST"
assert m.registry_check(IMAGE,lambda a:"(unset)")=="DIGEST_FIELD_NOT_RETURNED"
assert m.registry_check(IMAGE,lambda a:"sha256:"+("b"*64))=="DIGEST_MISMATCH"
assert m.registry_check(IMAGE,lambda a:"unexpected text")=="DIGEST_RESPONSE_FORMAT_UNRECOGNIZED"
result=m.inspect("recordingStatus",good)
assert result["stable"] and result["result"]=="DIGEST_METADATA_MATCHED_ONLY"
assert len(calls)==6
def error_reader(reason):
 def f(args):
  if args[:5]==["gcloud","artifacts","docker","images","describe"]:raise m.ReadFailure(reason)
  return good(args)
 return f
for reason in ("REGISTRY_ACCESS_DENIED","IMAGE_OR_REPOSITORY_NOT_FOUND","CLI_ARGUMENT_UNSUPPORTED","COMMAND_TIMEOUT"):
 result=m.inspect("recordingStatus",error_reader(reason))
 assert result["result"]==reason
def bad_project(args):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("must not query other project")
try:m.inspect("recordingStatus",bad_project)
except ValueError as e:assert str(e)=="WRONG_ACTIVE_PROJECT"
else:raise AssertionError("project fail-open")
try:m.inspect("reserveCredit",good)
except ValueError as e:assert str(e)=="FUNCTION_OUT_OF_SCOPE"
else:raise AssertionError("credit allowed")
print("P93C_HERMETIC_FAILURE_CLASSIFICATION=PASS")
