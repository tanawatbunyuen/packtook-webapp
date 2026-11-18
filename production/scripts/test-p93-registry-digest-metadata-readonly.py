#!/usr/bin/env python3
"""P93 fully hermetic registry metadata tests; never run gcloud."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p93-registry-digest-metadata-readonly.py")
spec=importlib.util.spec_from_file_location("p93",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p91=m.load("test_p91","p91-staging-image-lineage-readonly.py")
A="a"*64
B="b"*64
C="c"*64
def ref(d):
    return "asia-southeast1-docker.pkg.dev/packtook-staging/gcf-artifacts/status@sha256:"+d
assert m.image_digest(ref(A))==A
for x in ["us-central1-docker.pkg.dev/packtook-staging/r/x@sha256:"+A,
          "asia-southeast1-docker.pkg.dev/packtook-prod-01/r/x@sha256:"+A,
          "asia-southeast1-docker.pkg.dev/packtook-staging/r/../x@sha256:"+A,
          "asia-southeast1-docker.pkg.dev/packtook-staging/r/x:latest",
          "asia-southeast1-docker.pkg.dev/packtook-staging/r/x@sha256:abcd"]:
    assert m.image_digest(x) is None,(x,m.image_digest(x))
calls=[]
def result(args):
    calls.append(args)
    assert args[:5]==["gcloud","artifacts","docker","images","describe"]
    assert "--project" in args and "packtook-staging" in args
    return json.dumps({"image_summary":{"digest":"sha256:"+A}})
assert m.registry_status(ref(A),result)=="MATCHING_DIGEST_METADATA_READABLE_ONLY"
assert len(calls)==1
assert m.registry_status(ref(B),result)=="REGISTRY_NOT_VERIFIABLE"
assert m.registry_status("registry.invalid/repo/x@sha256:"+A,result)=="UNSUPPORTED_LOCATION_OR_REFERENCE"
assert len(calls)==2
def no_access(args):
    raise ValueError("permission denied")
assert m.registry_status(ref(A),no_access)=="REGISTRY_NOT_VERIFIABLE"
def revision(service,num,digest):
    return {"metadata":{"name":f"{service}-{num:05d}-abc",
                         "creationTimestamp":f"2026-11-{num:02d}T10:00:00Z"},
      "spec":{"containers":[{"image":ref(digest)}]}}
service="recordingstatus"
items=[revision(service,1,A),revision(service,2,B),revision(service,3,C),revision(service,4,A)]
picked=m.select_revisions(json.dumps(items),service,service+"-00004-abc",p91)
assert len(picked)==3
assert picked[0][1]==service+"-00004-abc"
assert [x[1] for x in picked[1:]]==[service+"-00003-abc",service+"-00002-abc"]
try:m.select_revisions(json.dumps(items),service,service+"-00005-abc",p91)
except ValueError:pass
else:raise AssertionError("missing current revision must reject")
def function(name):
    return json.dumps({"state":"ACTIVE","environment":"GEN_2",
      "serviceConfig":{"service":f"projects/packtook-staging/locations/asia-southeast1/services/{name.lower()}",
                       "revision":name.lower()+"-00004-abc"}})
def mock(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    if args[:3]==["gcloud","functions","describe"]:
        assert args[3]=="recordingStatus"
        return function(args[3])
    if args[:3]==["gcloud","run","revisions"]:
        return json.dumps([revision("recordingstatus",i,[A,B,C,A][i-1]) for i in range(1,5)])
    if args[:5]==["gcloud","artifacts","docker","images","describe"]:
        assert args[5].startswith("asia-southeast1-docker.pkg.dev/packtook-staging/")
        return json.dumps({"image_summary":{"digest":"sha256:"+m.image_digest(args[5])}})
    raise AssertionError("unexpected CLI invocation "+str(args[:4]))
row=m.inspect("recordingStatus",mock,p91)
assert row["stable"] and row["currentMetadataReadable"]
assert row["sampled"]==3 and row["priorChecked"]==2
assert row["priorMetadataReadable"]==2 and row["notVerifiable"]==0
try:m.inspect("reserveCredit",mock,p91)
except ValueError:pass
else:raise AssertionError("credit function must not be checked")
def wrong_project(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("no other Cloud reads on wrong project")
try:m.inspect("recordingStatus",wrong_project,p91)
except ValueError as e:assert str(e)=="P93_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project must fail")
print("P93_HERMETIC_REGISTRY_METADATA_MATRIX=PASS")
