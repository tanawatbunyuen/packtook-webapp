#!/usr/bin/env python3
"""P93B hermetic tests: never contacts real Cloud."""
import importlib.util,json
from pathlib import Path
path=Path(__file__).with_name("p93b-cloud-shell-safe-readonly.py")
spec=importlib.util.spec_from_file_location("p93b",path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
SHA="a"*64
IMAGE="asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/recordingstatus@sha256:"+SHA
assert m.image_pin(IMAGE)==SHA
for value in (
 "us-central1-docker.pkg.dev/packtook-staging/r/x@sha256:"+SHA,
 "asia-southeast1-docker.pkg.dev/packtook-prod-01/r/x@sha256:"+SHA,
 "asia-southeast1-docker.pkg.dev/packtook-staging/r/x:latest",
 "asia-southeast1-docker.pkg.dev/packtook-staging/r/../x@sha256:"+SHA,
 "asia-southeast1-docker.pkg.dev/packtook-staging/r/x@sha256:short"
): assert m.image_pin(value) is None, value
def function(n):
 return {"state":"ACTIVE","environment":"GEN_2",
   "serviceConfig":{"service":f"projects/packtook-staging/locations/asia-southeast1/services/{n.lower()}",
                    "revision":n.lower()+"-00001-abc"}}
assert m.function_revision(function("recordingStatus"),"recordingStatus")==("recordingstatus","recordingstatus-00001-abc")
def rev(n):
 return {"metadata":{"name":n},"spec":{"containers":[{"image":IMAGE}]}}
assert m.revision_image(rev("recordingstatus-00001-abc"),"recordingstatus-00001-abc")==IMAGE
assert m.registry_metadata(IMAGE,lambda _:json.dumps({"image_summary":{"digest":"sha256:"+SHA}}))
assert not m.registry_metadata(IMAGE,lambda _:json.dumps({"image_summary":{"digest":"sha256:"+("b"*64)}}))
calls=[]
def fake(argv):
 calls.append(argv)
 if argv[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if argv[:3]==["gcloud","functions","describe"]:return json.dumps(function(argv[3]))
 if argv[:3]==["gcloud","run","revisions"]:return json.dumps(rev("recordingstatus-00001-abc"))
 if argv[:5]==["gcloud","artifacts","docker","images","describe"]:
  assert argv[5]==IMAGE
  return json.dumps({"image_summary":{"digest":"sha256:"+SHA}})
 raise AssertionError("unknown call")
steps=[]
r=m.inspect("recordingStatus",fake,progress=steps.append)
assert r["metadataStable"] and r["digestMetadataMatched"]
assert len(calls)==5, calls
assert len(steps)==5 and steps[0]=="P93B_STEP=VERIFY_ACTIVE_PROJECT"
assert not any("list" in arg for call in calls for arg in call)
assert all("packtook-prod-01" not in str(x) for x in calls)
try:m.inspect("reserveCredit",fake)
except ValueError:pass
else:raise AssertionError("credit function not permitted")
def bad_project(argv):
 if argv[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("unexpected reads on wrong project")
try:m.inspect("recordingStatus",bad_project)
except ValueError as e:assert str(e)=="P93B_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("project guard failed")
def wrong_revision(argv):
 if argv[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if argv[:3]==["gcloud","functions","describe"]:return json.dumps(function(argv[3]))
 if argv[:3]==["gcloud","run","revisions"]:return json.dumps(rev("recordingstatus-99999-def"))
 raise AssertionError("must fail before registry")
try:m.inspect("recordingStatus",wrong_revision)
except ValueError as e:assert str(e)=="P93B_REVISION_MISMATCH"
else:raise AssertionError("mismatched revision not rejected")
def drift(argv):
 if argv[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if argv[:3]==["gcloud","functions","describe"]:
  drift.count+=1
  data=function(argv[3])
  if drift.count>1:data["updateTime"]="changed"
  return json.dumps(data)
 if argv[:3]==["gcloud","run","revisions"]:return json.dumps(rev("recordingstatus-00001-abc"))
 if argv[:5]==["gcloud","artifacts","docker","images","describe"]:
  return json.dumps({"image_summary":{"digest":"sha256:"+SHA}})
 raise AssertionError("unexpected command")
drift.count=0
assert m.inspect("recordingStatus",drift)["metadataStable"] is False
try:m.function_revision({"state":"FAILED","environment":"GEN_2"},"recordingStatus")
except ValueError:pass
else:raise AssertionError("inactive revision passed")
print("P93B_HERMETIC_BOUNDED_REGISTRY_CHECK=PASS")
