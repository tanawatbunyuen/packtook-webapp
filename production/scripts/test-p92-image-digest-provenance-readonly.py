#!/usr/bin/env python3
"""P92 hermetic fake metadata tests, no Cloud calls."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p92-image-digest-provenance-readonly.py")
spec=importlib.util.spec_from_file_location("p92",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
helper=m.load_previous()
def rev(name,image,ready=True):
    return {"metadata":{"name":name,"creationTimestamp":"2026-11-18T00:00:00Z"},
       "status":{"conditions":[{"type":"Ready","status":"True" if ready else "False"}]},
       "spec":{"containers":[{"image":image}]}}
service="recordingstatus"
sha="a"*64
sha2="b"*64
entries=[rev(service+"-00001-a","registry.invalid/app@sha256:"+sha),
         rev(service+"-00002-b","registry.invalid/app:v2"),
         rev(service+"-00003-c","registry.invalid/app@sha256:"+sha2,False)]
r=m.classify_images(json.dumps(entries),service,service+"-00003-c",helper)
assert r["visible"]==3
assert r["digestPinned"]==2 and r["nonDigest"]==1
assert r["distinctDigestValues"]==2
assert r["readyDigestCount"]==1
assert r["currentImageDigestPinned"] is True
assert r["knownGoodRevision"]=="NOT_SELECTED"
assert r["restorableRollback"]=="NOT_VERIFIED"
r=m.classify_images(json.dumps(entries),service,service+"-00002-b",helper)
assert r["currentInHistory"] and not r["currentImageDigestPinned"]
r=m.classify_images(json.dumps(entries),service,service+"-00004-d",helper)
assert not r["currentInHistory"]
for bad in [
    json.dumps([entries[0],entries[0]]),
    json.dumps([rev("not-the-service-00001-a","registry.invalid/app@sha256:"+sha)]),
    json.dumps([rev(service+"-00001-a","registry.invalid/app@sha256:short")]),
    json.dumps([{"metadata":{"name":service+"-00001-a"},"spec":{"containers":[]}}]),
    json.dumps([{"metadata":{"name":service+"-00001-a"},"status":{"conditions":"not-list"},"spec":{"containers":[{"image":"valid"}]}}]),
]:
    if "short" in bad:
        result=m.classify_images(bad,service,service+"-00001-a",helper)
        assert result["nonDigest"]==1
        continue
    try:m.classify_images(bad,service,service+"-00001-a",helper)
    except ValueError:pass
    else:raise AssertionError("invalid revision metadata must fail")
def function(name):
    return json.dumps({"state":"ACTIVE","environment":"GEN_2",
      "serviceConfig":{"service":f"projects/packtook-staging/locations/asia-southeast1/services/{name.lower()}",
                       "revision":name.lower()+"-00002-b"}})
def fake(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    if args[:3]==["gcloud","functions","describe"]:return function(args[3])
    if args[:3]==["gcloud","run","revisions"]:
        srv=args[args.index("--service")+1]
        return json.dumps([rev(srv+"-00001-a","registry.invalid/app:v1"),
                           rev(srv+"-00002-b","registry.invalid/app@sha256:"+sha)])
    raise AssertionError("out-of-scope command")
rows=m.inspect(fake,helper)
assert len(rows)==2
assert all(r["visible"]==2 and r["digestPinned"]==1 for r in rows)
assert all(r["stable"] and r["currentInHistory"] for r in rows)
def wrong(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("wrong project cannot read metadata")
try:m.inspect(wrong,helper)
except ValueError as e:assert str(e)=="P92_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("project guard failed")
print("P92_HERMETIC_DIGEST_CLASSIFICATION=PASS")
