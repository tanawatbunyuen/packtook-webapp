#!/usr/bin/env python3
"""P91 hermetic tests; no actual Google Cloud calls."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p91-staging-image-lineage-readonly.py")
spec=importlib.util.spec_from_file_location("p91",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def rev(name,img):
    return {"metadata":{"name":name},"spec":{"containers":[{"image":img}]}}
service="recordingstatus"
a=rev(service+"-00001-a","repo/image@sha256:aaaa")
b=rev(service+"-00002-b","repo/image@sha256:aaaa")
c=rev(service+"-00003-c","repo/image@sha256:bbbb")
r=m.summarize(json.dumps([a,b,c]),service,service+"-00003-c")
assert r["visibleRevisions"]==3
assert r["distinctImageReferences"]==2
assert r["currentRevisionInHistory"] is True
assert r["revisionsSharingCurrentImage"]==1
assert r["priorKnownGoodImage"]=="NOT_VERIFIED"
r=m.summarize(json.dumps([a,b,c]),service,service+"-00004-d")
assert r["currentRevisionInHistory"] is False
assert r["revisionsSharingCurrentImage"]==0
for bad in [
  json.dumps([a,a]),json.dumps([rev("wrong-00001-a","img")]),
  json.dumps([{"metadata":{"name":service+"-00001-a"},"spec":{"containers":[]}}]),
  json.dumps([rev("../"+service+"-00001-a","img")]),
  json.dumps([rev("projects/packtook-prod-01/locations/asia-southeast1/revisions/"+service+"-00001-a","img")])
]:
    try:m.summarize(bad,service,service+"-00001-a")
    except ValueError:pass
    else:raise AssertionError("untrusted metadata must fail")
def fun(name):
    return json.dumps({"state":"ACTIVE","environment":"GEN_2",
       "serviceConfig":{"service":"projects/packtook-staging/locations/asia-southeast1/services/"+name.lower(),
                       "revision":name.lower()+"-00002-b"}})
def fake(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    if args[:3]==["gcloud","functions","describe"]:return fun(args[3])
    if args[:3]==["gcloud","run","revisions"]:
        srv=args[args.index("--service")+1]
        return json.dumps([rev(srv+"-00001-a","image:A"),rev(srv+"-00002-b","image:B")])
    raise AssertionError("unexpected tool command")
rows=m.inspect(fake)
assert len(rows)==2
assert all(r["metadataStable"] and r["currentRevisionInHistory"] for r in rows)
assert all(r["distinctImageReferences"]==2 for r in rows)
def wrong_project(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("must fail before any metadata reads")
try:m.inspect(wrong_project)
except ValueError as e:assert str(e)=="P91_WRONG_PROJECT"
else:raise AssertionError("wrong project must fail")
print("P91_HERMETIC_IMAGE_LINEAGE_MATRIX=PASS")
