#!/usr/bin/env python3
"""P90 synthetic Cloud Run revision inventory tests. No actual gcloud calls."""
import importlib.util,json
from pathlib import Path
path=Path(__file__).with_name("p90-staging-revision-quality-readonly.py")
spec=importlib.util.spec_from_file_location("p90",path)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def revision(service,index,ready=True):
    return {"metadata":{"name":f"{service}-{index:05d}-abc",
           "creationTimestamp":"2026-11-18T00:00:00Z"},
        "status":{"conditions":[{"type":"Ready","status":"True" if ready else "False"}]},
        "spec":{"containers":[{"image":"example.invalid/demo@sha256:abc"}]}}
def list_json(service):
    return json.dumps([revision(service,1),revision(service,2,False)])
r=m.summarize_revisions(list_json("recordingstatus"),"recordingstatus")
assert r["count"]==2 and r["readyMetadataCount"]==1
assert r["creationTimePresentCount"]==2 and r["imageReferencePresentCount"]==2
assert r["knownGood"]=="NOT_VERIFIED" and r["rollbackRestorable"]=="NOT_VERIFIED"
assert m.summarize_revisions("[]","recordingstatus")["count"]==0
for wrong in [
    json.dumps([revision("other-service",1)]),
    json.dumps({"items":[]}),
    json.dumps([{"metadata":{"name":"recordingstatus-00001-a"},"status":{"conditions":"not-list"}}]),
    json.dumps([{"metadata":{"name":"projects/packtook-prod-01/locations/asia-southeast1/revisions/recordingstatus-00001-a"}}]),
    json.dumps([{"metadata":{"name":"bad/../recordingstatus-00001-a"}}])
]:
    try:m.summarize_revisions(wrong,"recordingstatus")
    except ValueError:pass
    else:raise AssertionError("untrusted revision metadata must fail")
def function(name):
    return json.dumps({"state":"ACTIVE","environment":"GEN_2",
       "serviceConfig":{"service":f"projects/packtook-staging/locations/asia-southeast1/services/{name.lower()}"}})
def fake(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    if args[:3]==["gcloud","functions","describe"]:
        assert args[3] in m.TARGETS
        return function(args[3])
    if args[:3]==["gcloud","run","revisions"]:
        assert args[3]=="list"
        service=args[args.index("--service")+1]
        return list_json(service)
    raise AssertionError("command out of scope")
rows=m.inspect(fake)
assert len(rows)==2 and all(x["state"]=="STABLE_HISTORY_METADATA_ONLY" for x in rows)
assert all(x["count"]==2 for x in rows)
def wrong_project(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("no metadata read permitted on wrong project")
try:m.inspect(wrong_project)
except ValueError as e:assert str(e)=="P90_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("project guard not enforced")
print("P90_SYNTHETIC_REVISION_QUALITY_MATRIX=PASS")
