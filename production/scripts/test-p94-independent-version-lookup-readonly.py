#!/usr/bin/env python3
"""P94 hermetic independent Artifact Registry version check, no real gcloud."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p94-independent-version-lookup-readonly.py")
spec=importlib.util.spec_from_file_location("p94",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p93c=m.load_p93c();p93b=p93c.load_p93b()
D="a"*64
I="asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/recordingstatus@sha256:"+D
assert m.parse_image(I,p93b)==("gcf-artifacts","recordingstatus",D)
for bad in ["gcr.io/packtook-staging/r/image@sha256:"+D,
  "asia-southeast1-docker.pkg.dev/packtook-prod-01/r/image@sha256:"+D,
  "asia-southeast1-docker.pkg.dev/packtook-staging/r/../image@sha256:"+D]:
 try:m.parse_image(bad,p93b)
 except ValueError:pass
 else:raise AssertionError("bad image allowed")
def version_name():
 return "projects/packtook-staging/locations/asia-southeast1/repositories/gcf-artifacts/packages/recordingstatus/versions/sha256:"+D
calls=[]
def mock_version(args):
 calls.append(args)
 assert args[:4]==["gcloud","artifacts","versions","describe"]
 assert args[4]=="sha256:"+D
 assert args[args.index("--package")+1]=="recordingstatus"
 assert args[args.index("--repository")+1]=="gcf-artifacts"
 return version_name()
assert m.secondary_version_check(I,mock_version,p93c,p93b)=="PACKAGE_VERSION_METADATA_MATCHED_ONLY"
assert len(calls)==1
assert m.secondary_version_check(I,lambda _:"wrong",p93c,p93b)=="VERSION_RESOURCE_NOT_VERIFIABLE"
def not_found(args):raise p93c.ReadFailure("IMAGE_OR_REPOSITORY_NOT_FOUND")
assert m.secondary_version_check(I,not_found,p93c,p93b)=="PACKAGE_VERSION_NOT_FOUND_OR_HIDDEN"
def denied(args):raise p93c.ReadFailure("REGISTRY_ACCESS_DENIED")
assert m.secondary_version_check(I,denied,p93c,p93b)=="VERSION_ACCESS_DENIED"
def current_func():
 return {"state":"ACTIVE","environment":"GEN_2","serviceConfig":{
  "service":"projects/packtook-staging/locations/asia-southeast1/services/recordingstatus",
  "revision":"recordingstatus-00001-abc"}}
def revision():
 return {"metadata":{"name":"recordingstatus-00001-abc"},
  "spec":{"containers":[{"image":I}]}}
calls=[]
def simulation(args):
 calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:return json.dumps(current_func())
 if args[:3]==["gcloud","run","revisions"]:return json.dumps(revision())
 if args[:5]==["gcloud","artifacts","docker","images","describe"]:
  raise p93c.ReadFailure("IMAGE_OR_REPOSITORY_NOT_FOUND")
 if args[:4]==["gcloud","artifacts","versions","describe"]:
  return version_name()
 raise AssertionError("unexpected command")
steps=[]
result=m.inspect("recordingStatus",simulation,steps.append)
assert result["stable"] and result["original"]=="IMAGE_OR_REPOSITORY_NOT_FOUND"
assert result["secondary"]=="PACKAGE_VERSION_METADATA_MATCHED_ONLY"
assert len(calls)==6 and steps[-1]=="P94_STEP=INDEPENDENT_VERSION_METADATA"
def no404(args):
 if args[:5]==["gcloud","artifacts","docker","images","describe"]:
  return "sha256:"+D
 if args[:4]==["gcloud","artifacts","versions","describe"]:
  raise AssertionError("secondary check must be skipped when digest matches")
 return simulation(args)
start=len(calls)
assert m.inspect("recordingStatus",no404)["secondary"]=="NOT_RUN"
assert len(calls)-start==4
def wrong_project(args):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("wrong project must stop immediately")
try:m.inspect("recordingStatus",wrong_project)
except ValueError as e:assert str(e)=="WRONG_ACTIVE_PROJECT"
else:raise AssertionError("project guard failed")
print("P94_INDEPENDENT_VERSION_LOOKUP_HERMETIC=PASS")
