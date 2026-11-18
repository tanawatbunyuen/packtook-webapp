#!/usr/bin/env python3
"""P89 all-offline simulated Cloud CLI. Never invokes real gcloud."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p89-staging-revision-history-readonly.py")
spec=importlib.util.spec_from_file_location("p89",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def info(name="recordingStatus"):
    return {"state":"ACTIVE","environment":"GEN_2",
     "serviceConfig":{"service":"projects/packtook-staging/locations/asia-southeast1/services/"+name.lower()}}
assert m.service_name(info())=="recordingstatus"
for wrong in [
 {"state":"FAILED","environment":"GEN_2","serviceConfig":info()["serviceConfig"]},
 {"state":"ACTIVE","environment":"GEN_1","serviceConfig":info()["serviceConfig"]},
 {"state":"ACTIVE","environment":"GEN_2","serviceConfig":{"service":"projects/packtook-prod-01/locations/asia-southeast1/services/recordingstatus"}},
 {"state":"ACTIVE","environment":"GEN_2","serviceConfig":{"service":"projects/packtook-staging/locations/us-central1/services/recordingstatus"}},
 {"state":"ACTIVE","environment":"GEN_2","serviceConfig":{"service":"projects/packtook-staging/locations/asia-southeast1/services/../recordingstatus"}}
]:
    try:m.service_name(wrong)
    except ValueError:pass
    else:raise AssertionError("wrong scope must fail")
def rev(names):return json.dumps([{"metadata":{"name":n}} for n in names])
assert m.revision_summary(rev(["recordingstatus-00001-abc"]),"recordingstatus")["revisionCount"]==1
assert m.revision_summary(rev(["recordingstatus-00001-abc","recordingstatus-00002-def"]),"recordingstatus")["multipleVisibleRevisions"]
assert m.revision_summary(rev([]),"recordingstatus")["previousRevisionRestorable"]=="NOT_VERIFIED"
for bad in [rev(["bad/../rev"]),rev(["dup","dup"]),json.dumps({"items":[]})]:
    try:m.revision_summary(bad,"recordingstatus")
    except ValueError:pass
    else:raise AssertionError("invalid history must fail")
def good(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    if args[:3]==["gcloud","functions","describe"]:
        assert args[3] in m.TARGETS
        assert "--project" in args and "packtook-staging" in args
        return json.dumps(info(args[3]))
    assert args[:3]==["gcloud","run","revisions"]
    assert "--service" in args and "--region" in args and "--project" in args
    return rev(["rev-00001-abc","rev-00002-def"])
result=m.inspect(good)
assert len(result)==2 and all(r["revisionCount"]==2 for r in result)
assert all(r["state"]=="HISTORY_METADATA_ONLY" for r in result)
assert all(r["previousRevisionGood"]=="NOT_VERIFIED" for r in result)
def wrong_project(args):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("must never read function on wrong project")
try:m.inspect(wrong_project)
except ValueError as e:assert str(e)=="P89_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("active Staging project check failed")
print("P89_REVISION_HISTORY_OFFLINE_MATRIX=PASS")
