#!/usr/bin/env python3
"""P84 synthetic-gcloud tests only. No external/real API calls."""
import importlib.util
import json
from pathlib import Path
path=Path(__file__).with_name("p84-deployment-scope-readonly.py")
spec=importlib.util.spec_from_file_location("p84",path)
p84=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p84)
def obj(pin="one",identity="sa@invalid.example",codebase=None):
    labels={} if codebase is None else {"deployment-codebase":codebase}
    return {"environment":"GEN_2","state":"ACTIVE","labels":labels,
      "updateTime":"2026-11-18T00:00:00Z",
      "buildConfig":{"source":{"storageSource":{
        "bucket":"gcf-v2-sources-100-asia-southeast1",
        "object":pin+".zip","generation":"123"}}},
      "serviceConfig":{"serviceAccountEmail":identity,
        "revision":"rev-1","availableMemory":"256Mi",
        "timeoutSeconds":30,"ingressSettings":"ALLOW_ALL"}}
names=p84.TARGETS
assert len(names)==5 and len(p84.STATUS)==2 and len(p84.CREDIT)==3
a=p84.summary(obj())
assert p84.compare(a,a)=="STABLE_METADATA_ONLY"
assert p84.compare(a,{**a,"revision":"rev-2"})=="DRIFT_REVIEW_REQUIRED"
assert p84.compare(a,{**a,"sourcePin":None})=="DRIFT_REVIEW_REQUIRED"
assert p84.compare(a,{**a,"identity":"changed"})=="DRIFT_REVIEW_REQUIRED"
assert p84.compare(None,a)=="NOT_VERIFIABLE"
assert p84.compare({**a,"revision":None},{**a,"revision":None})=="MISSING_REQUIRED_METADATA"
all_same={n:p84.summary(obj()) for n in names}
r=p84.evaluate(all_same,all_same)
assert r["sourceArchiveSharedAcrossScope"] is True
assert r["identitiesShared"] is True
assert r["safeDeploySelector"]=="NOT_VERIFIED"
assert r["restorableRollback"]=="NOT_VERIFIED"
assert r["stageDeployment"]=="BLOCKED"
different={n:p84.summary(obj(pin="status" if n in p84.STATUS else "credit")) for n in names}
r=p84.evaluate(different,different)
assert r["sourceArchiveSharedAcrossScope"] is False
assert r["safeDeploySelector"]=="NOT_VERIFIED"
assert {x["name"] for x in r["rows"] if x["role"]=="REMEDIATION_TARGET"}==set(p84.STATUS)
assert {x["name"] for x in r["rows"] if x["role"]=="EXCLUDED_CREDIT_FUNCTION"}==set(p84.CREDIT)
try:p84.evaluate({"recordingStatus":a},{"recordingStatus":a})
except ValueError:pass
else:raise AssertionError("incomplete scope must block")
def reader(command):
    if command[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    assert command[:3]==["gcloud","functions","describe"]
    assert command[3] in names
    assert "--project" in command and "packtook-staging" in command
    return json.dumps(obj(pin="status" if command[3] in p84.STATUS else "credit"))
r=p84.inspect(reader)
assert len(r["rows"])==5 and r["sourceArchiveSharedAcrossScope"] is False
def wrong(command):
    if command[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("must not read any function from Production")
try:p84.inspect(wrong)
except ValueError as e:assert str(e)=="P84_WRONG_PROJECT"
else:raise AssertionError("wrong active project must block")
try:p84.summary({"environment":"GEN_1","state":"ACTIVE"})
except ValueError:pass
else:raise AssertionError("Gen1 must block")
print("P84_OFFLINE_SCOPE_MATRIX=PASS")
