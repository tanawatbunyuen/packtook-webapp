#!/usr/bin/env python3
"""P104 hermetic source-metadata tests. Never contacts Cloud."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p104-build-provenance-readonly.py")
spec=importlib.util.spec_from_file_location("p104",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def item(n,source="shared",project="packtook-staging",entry=None):
 return {"name":f"projects/{project}/locations/asia-southeast1/functions/{n}",
 "environment":"GEN_2",
 "buildConfig":{"runtime":"nodejs22","entryPoint":n if entry is None else entry,
   "source":{"storageSource":{"bucket":"private-test-bucket","object":source,"generation":"12"}}},
 "serviceConfig":{"service":f"projects/{project}/locations/asia-southeast1/services/{n.lower()}"}}
def summary(n,raw):return m.build_summary(n,json.dumps(raw))
assert summary("recordingStatus",item("recordingStatus"))["entryExpected"]
assert summary("recordingStatus",item("recordingStatus"))["serviceValid"]
assert summary("recordingStatus",item("recordingStatus",entry="wrong"))["entryExpected"] is False
assert summary("recordingStatus",{"name":m.BASE+"recordingStatus","environment":"GEN_2",
    "buildConfig":{"runtime":"nodejs22","entryPoint":"recordingStatus"},
    "serviceConfig":{"service":m.BASE+"recordingStatus"}})["sourceKey"] is None
for bad in [
 item("recordingStatus",project="packtook-prod-01"),
 item("usageStatus"),
 {"name":m.BASE+"recordingStatus","environment":"GEN_1","buildConfig":{},"serviceConfig":{}},
 {"name":m.BASE+"recordingStatus","environment":"GEN_2","buildConfig":[],"serviceConfig":{}},
 ]:
 try:summary("recordingStatus",bad)
 except ValueError:pass
 else:raise AssertionError("P104 should reject out-of-scope resource")
calls=[]
def fake(args):
 calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:
  assert "--gen2" in args and "--region" in args and "asia-southeast1" in args
  return json.dumps(item(args[3]))
 raise AssertionError("unexpected gcloud read")
r=m.inspect(fake)
assert len(calls)==6
assert r["runtimeCount"]==5 and r["entryMatchCount"]==5 and r["serviceCount"]==5
assert r["sourceCount"]==5 and r["sourceGroups"]==1
assert r["sourceState"]=="ALL_FIVE_SAME_SOURCE_REFERENCE"
def multi(args):
 if args[:3]==["gcloud","functions","describe"]:
  return json.dumps(item(args[3],source=args[3]))
 return fake(args)
r=m.inspect(multi)
assert r["sourceGroups"]==5 and r["sourceState"]=="MULTIPLE_SOURCE_REFERENCES"
def no_source(args):
 if args[:3]==["gcloud","functions","describe"]:
  d=item(args[3]);d["buildConfig"].pop("source");return json.dumps(d)
 return fake(args)
r=m.inspect(no_source)
assert r["sourceState"]=="NO_SOURCE_REFERENCES_VISIBLE" and r["sourceCount"]==0
def wrong(args):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("read after failed project guard")
try:m.inspect(wrong)
except ValueError as e:assert str(e)=="P104_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project accepted")
print("P104_HERMETIC_BUILD_SOURCE_PROVENANCE=PASS")
