#!/usr/bin/env python3
"""P87 fake-gcloud tests only. No real project/service credentials used."""
import importlib.util
import json
from pathlib import Path
p=Path(__file__).with_name("p87-source-provenance-readonly.py")
spec=importlib.util.spec_from_file_location("p87",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p61=m.load_attestation()
def data(n="recordingStatus",generation="123456789",revision="revision-a"):
    return {"state":"ACTIVE","environment":"GEN_2",
      "updateTime":"2026-11-18T00:00:00Z",
      "buildConfig":{"runtime":"nodejs22","source":{"storageSource":{
        "bucket":"gcf-v2-sources-123456789-asia-southeast1",
        "object":n+".zip","generation":generation}}},
      "serviceConfig":{"revision":revision,
       "serviceAccountEmail":"operator-internal@example.invalid",
       "timeoutSeconds":60,"availableMemory":"256Mi"}}
def parse(n):
    return m.summarize(json.dumps(data(n)),p61.pinned_source)
assert p61.pinned_source(data()) is not None
baseline={n:parse(n) for n in m.TARGETS}
r=m.evaluate(baseline,baseline)
assert len(r["rows"])==5
assert all(x["provenance"]=="STABLE_PINNED_SOURCE_METADATA_ONLY" for x in r["rows"])
assert r["crossScopePinShared"] is False
assert r["pinnedSourceRestorable"]=="NOT_VERIFIED"
assert r["immutablePriorRevisionIdentified"]=="NOT_VERIFIED"
assert r["stagingDeploy"]=="BLOCKED"
shared={n:parse("shared") for n in m.TARGETS}
assert m.evaluate(shared,shared)["crossScopePinShared"] is True
drift=dict(baseline)
drift["recordingStatus"]={**drift["recordingStatus"],"revision":"rev-b"}
r=m.evaluate(baseline,drift)
assert r["rows"][0]["provenance"]=="DRIFT_REVIEW_REQUIRED"
missing=dict(baseline)
missing["recordingStatus"]={**missing["recordingStatus"],"sourcePin":None}
r=m.evaluate(missing,missing)
assert r["rows"][0]["provenance"]=="PROVENANCE_INCOMPLETE"
assert m.summarize(json.dumps(data(generation="not-a-number")),p61.pinned_source)["sourcePin"] is None
try:m.evaluate({"recordingStatus":baseline["recordingStatus"]},baseline)
except ValueError:pass
else:raise AssertionError("incomplete target set must fail")
try:m.summarize(json.dumps({"state":"FAILED","environment":"GEN_2"}),p61.pinned_source)
except ValueError:pass
else:raise AssertionError("non-active functions must fail")
def reader(cmd):
    if cmd[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    assert cmd[:3]==["gcloud","functions","describe"]
    assert cmd[3] in m.TARGETS
    assert "--project" in cmd and "packtook-staging" in cmd
    return json.dumps(data(cmd[3]))
assert len(m.inspect(reader,p61.pinned_source)["rows"])==5
def wrong(cmd):
    if cmd[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("must never read other project function metadata")
try:m.inspect(wrong,p61.pinned_source)
except ValueError as e:assert str(e)=="P87_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("project guard failed")
print("P87_OFFLINE_PINNED_PROVENANCE_MATRIX=PASS")
