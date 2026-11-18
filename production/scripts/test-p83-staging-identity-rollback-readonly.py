#!/usr/bin/env python3
"""P83 synthetic-only tests; never starts gcloud."""
import importlib.util
import json
from pathlib import Path
script=Path(__file__).with_name("p83-staging-identity-rollback-readonly.py")
spec=importlib.util.spec_from_file_location("p83read",script)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
def fixture(rev="rev-A",identity="svc@example.invalid",codebase=None):
    labels={} if codebase is None else {"deployment-codebase":codebase}
    return {
      "environment":"GEN_2","state":"ACTIVE",
      "updateTime":"2026-11-18T00:00:00Z",
      "labels":labels,
      "buildConfig":{"source":{"storageSource":{
        "bucket":"private-bucket","object":"private-object.zip","generation":"123"}}},
      "serviceConfig":{"serviceAccountEmail":identity,"revision":rev,
        "ingressSettings":"ALLOW_ALL","availableMemory":"256M","timeoutSeconds":30}
    }
base=m.minimal(fixture())
assert m.classify(base,base)=="STABLE_METADATA_ONLY"
assert m.classify(base,m.minimal(fixture(rev="rev-B")))=="METADATA_DRIFT"
assert m.classify(base,m.minimal(fixture(identity="changed@example.invalid")))=="METADATA_DRIFT"
assert m.classify(base,{**base,"source":None})=="METADATA_DRIFT"
assert m.classify(base,{**base,"codebase":"different"})=="METADATA_DRIFT"
assert m.classify(None,base)=="NOT_VERIFIABLE"
assert m.classify({**base,"identity":None},{**base,"identity":None})=="INSUFFICIENT_SOURCE_IDENTITY"
try:m.minimal({"environment":"GEN_1","state":"ACTIVE"})
except ValueError:pass
else:raise AssertionError("must reject Gen1")
def safe(command):
    if command[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    assert command[:3]==["gcloud","functions","describe"]
    assert command[3] in m.TARGETS
    assert "--project" in command and "packtook-staging" in command
    return json.dumps(fixture())
r=m.inspect(safe)
assert len(r["rows"])==5
assert all(x["metadata"]=="STABLE_METADATA_ONLY" for x in r["rows"])
assert all(x["codebase_ownership"]=="NOT_VERIFIED" for x in r["rows"])
assert all(x["rollback_restorable"]=="NOT_VERIFIED" for x in r["rows"])
assert all(x["backend_app_check"]=="NOT_PROVEN" for x in r["rows"])
assert r["shared_runtime_identity"] is True
def wrong(command):
    if command[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("must not describe Production functions")
try:m.inspect(wrong)
except ValueError as exc:assert str(exc)=="P83_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project not rejected")
def missing_source(command):
    if command[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    x=fixture()
    x["buildConfig"]["source"]["storageSource"].pop("generation")
    return json.dumps(x)
r=m.inspect(missing_source)
assert all(x["metadata"]=="INSUFFICIENT_SOURCE_IDENTITY" for x in r["rows"])
assert all(not x["source_generation_pinned"] for x in r["rows"])
print("P83_OFFLINE_METADATA_MATRIX=PASS")
