#!/usr/bin/env python3
"""Hermetic P93D repository vs image 404 triage. No real Cloud."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p93d-registry-404-readonly.py")
spec=importlib.util.spec_from_file_location("p93d",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p93c=m.load_p93c()
p93b=p93c.load_p93b()
SHA="a"*64
IMAGE="asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/recordingstatus@sha256:"+SHA
assert m.repo_name(IMAGE,p93b)=="gcf-artifacts"
def function():
 return {"state":"ACTIVE","environment":"GEN_2","serviceConfig":{
  "service":"projects/packtook-staging/locations/asia-southeast1/services/recordingstatus",
  "revision":"recordingstatus-00001-abc"}}
def revision():
 return {"metadata":{"name":"recordingstatus-00001-abc"},
  "spec":{"containers":[{"image":IMAGE}]}}
calls=[]
def fake(args):
 calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:return json.dumps(function())
 if args[:3]==["gcloud","run","revisions"]:return json.dumps(revision())
 if args[:5]==["gcloud","artifacts","docker","images","describe"]:
  raise p93c.ReadFailure("IMAGE_OR_REPOSITORY_NOT_FOUND")
 if args[:4]==["gcloud","artifacts","repositories","describe"]:
  assert args[4]=="gcf-artifacts"
  return "projects/packtook-staging/locations/asia-southeast1/repositories/gcf-artifacts"
 raise AssertionError("unexpected command")
steps=[]
r=m.inspect("recordingStatus",fake,steps.append)
assert r["stable"]
assert r["imageLookup"]=="IMAGE_OR_REPOSITORY_NOT_FOUND"
assert r["repository"]=="REPOSITORY_METADATA_VISIBLE_DIGEST_LOOKUP_NOT_FOUND"
assert len(calls)==6 and steps[-1]=="P93D_STEP=CHECK_REPOSITORY_METADATA"
def changed(args):
 if args[:4]==["gcloud","artifacts","repositories","describe"]:
  raise p93c.ReadFailure("IMAGE_OR_REPOSITORY_NOT_FOUND")
 return fake(args)
assert m.inspect("recordingStatus",changed)["repository"]=="REPOSITORY_NOT_FOUND_OR_HIDDEN"
def denied(args):
 if args[:4]==["gcloud","artifacts","repositories","describe"]:
  raise p93c.ReadFailure("REGISTRY_ACCESS_DENIED")
 return fake(args)
assert m.inspect("recordingStatus",denied)["repository"]=="REPOSITORY_ACCESS_DENIED"
def no404(args):
 if args[:5]==["gcloud","artifacts","docker","images","describe"]:
  return "sha256:"+SHA
 if args[:4]==["gcloud","artifacts","repositories","describe"]:
  raise AssertionError("repo should not be checked when digest matches")
 return fake(args)
before=len(calls)
r=m.inspect("recordingStatus",no404)
assert r["imageLookup"]=="DIGEST_METADATA_MATCHED_ONLY"
assert r["repository"]=="NOT_CHECKED"
assert len(calls)-before==4
def wrong(args):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("must fail without other Cloud reads")
try:m.inspect("recordingStatus",wrong)
except ValueError as e:assert str(e)=="WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project allowed")
try:m.inspect("reserveCredit",fake)
except ValueError as e:assert str(e)=="FUNCTION_OUT_OF_SCOPE"
else:raise AssertionError("credit check allowed")
assert m.repository_probe(IMAGE,lambda _: "(unset)",p93c,p93b)=="REPOSITORY_METADATA_UNVERIFIABLE"
print("P93D_HERMETIC_404_RESOLUTION=PASS")
