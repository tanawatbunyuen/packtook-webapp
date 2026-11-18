#!/usr/bin/env python3
"""P79 all-offline fake gcloud responses. Never invokes gcloud."""
import importlib.util
import json
from pathlib import Path

path=Path(__file__).with_name("p79-staging-revision-readonly.py")
spec=importlib.util.spec_from_file_location("p79read",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def source(revision="r1",identity="service@example.invalid"):
    return {"state":"ACTIVE","environment":"GEN_2",
     "updateTime":"2026-11-18T00:00:00Z",
     "buildConfig":{"source":{"storageSource":{"bucket":"demo","object":revision}}},
     "serviceConfig":{"serviceAccountEmail":identity,"revision":revision}}

sample=mod.summarize(source())
assert mod.classify(sample,sample)=="STABLE_METADATA_ONLY"
assert mod.classify(sample,mod.summarize(source("r2")))=="DRIFT_REVIEW_REQUIRED"
assert mod.classify(sample,mod.summarize(source(identity="other@example.invalid")))=="DRIFT_REVIEW_REQUIRED"
assert mod.classify(sample,{**sample,"identity":None})=="DRIFT_REVIEW_REQUIRED"
assert mod.classify(None,sample)=="NOT_VERIFIABLE"
assert mod.classify({**sample,"state":"FAILED"},{**sample,"state":"FAILED"})=="NOT_ACTIVE_OR_NOT_GEN2"
def stub(command):
    if command[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    assert command[:3]==["gcloud","functions","describe"]
    assert "--project" in command and "packtook-staging" in command
    return json.dumps(source())
result=mod.inspect(stub)
assert result["project"]=="STAGING_CONFIRMED"
assert len(result["checks"])==5
assert all(x["state"]=="STABLE_METADATA_ONLY" for x in result["checks"])
assert all(x["app_check"]=="NOT_PROVEN" for x in result["checks"])
def bad(command):
    if command[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("cloud describe must never be called")
assert mod.inspect(bad)["project"]=="WRONG_ACTIVE_PROJECT"
print("P79_OFFLINE_TESTS=PASS")
