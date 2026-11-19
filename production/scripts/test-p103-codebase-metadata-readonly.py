#!/usr/bin/env python3
"""P103 hermetic fake CLI tests; never contact Google Cloud."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p103-codebase-metadata-readonly.py")
spec=importlib.util.spec_from_file_location("p103",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
def item(n,label="beta",project="packtook-staging",environment="GEN_2"):
  return {"name":f"projects/{project}/locations/asia-southeast1/functions/{n}",
    "environment":environment,"labels":{} if label is None else {"firebase-functions-codebase":label}}
assert m.codebase("usageStatus",json.dumps(item("usageStatus")))=="BETA"
assert m.codebase("usageStatus",json.dumps(item("usageStatus",None)))=="ABSENT"
assert m.codebase("usageStatus",json.dumps(item("usageStatus","other")))=="CONFLICT"
for bad in [item("usageStatus",project="packtook-prod-01"),item("reserveCredit"),
    item("usageStatus",environment="GEN_1")]:
  try:m.codebase("usageStatus",json.dumps(bad))
  except ValueError:pass
  else:raise AssertionError("out of scope metadata accepted")
calls=[]
def factory(labels):
  def reader(argv):
    calls.append(argv)
    if argv[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    if argv[:3]==["gcloud","functions","describe"]:
      return json.dumps(item(argv[3],labels.get(argv[3],"beta")))
    raise AssertionError("unexpected read")
  return reader
ok=m.inspect(factory({}))
assert ok["result"]=="ALL_FIVE_BETA_LABELS"
assert ok["statusBeta"]==2 and ok["creditBeta"]==3
assert len(calls)==6
assert all("packtook-prod-01" not in str(x) for x in calls)
calls.clear()
missing=m.inspect(factory({n:None for n in m.TARGETS}))
assert missing["result"]=="ALL_FIVE_LABELS_ABSENT"
assert missing["absent"]==5
calls.clear()
mixed=m.inspect(factory({"recordingStatus":None}))
assert mixed["result"]=="PARTIAL_BETA_LABELS"
calls.clear()
conflict=m.inspect(factory({"finalizeCredit":"owner"}))
assert conflict["result"]=="CONFLICTING_LABELS"
def wrong(argv):
  if argv[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
  raise AssertionError("read after wrong project")
try:m.inspect(wrong)
except ValueError as e:assert str(e)=="P103_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project not blocked")
print("P103_HERMETIC_CODEBASE_LABEL_CLASSIFICATION=PASS")
