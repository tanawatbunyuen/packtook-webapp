#!/usr/bin/env python3
"""P102 hermetic Staging-only inventory tests. NO Cloud operations."""
import importlib.util,json
from pathlib import Path
p=Path(__file__).with_name("p102-staging-function-inventory-readonly.py")
spec=importlib.util.spec_from_file_location("p102",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
names=["recordingStatus","usageStatus","reserveCredit","finalizeCredit","recoverStaleVideoReservation"]
def resource(name,label="beta",project="packtook-staging"):
 return {"name":f"projects/{project}/locations/asia-southeast1/functions/{name}",
  "labels":{} if label is None else {"firebase-functions-codebase":label}}
def payload(items):return json.dumps(items)
base=[resource(x) for x in names]
a=m.parse(payload(base))
assert a["count"]==5 and a["collisionCount"]==0
assert a["codebaseState"]=="BETA_LABELS_OBSERVED_FOR_ALL_FIVE"
a=m.parse(payload([resource(x,None) for x in names]))
assert a["codebaseState"]=="PARTIAL_OR_ABSENT_LABELS"
a=m.parse(payload([resource(x) for x in names]+[resource("recordingStatus-shadow")]))
assert a["collisionCount"]==1
a=m.parse(payload([resource(x) for x in names]+[resource("usageStatus-subgroup")]))
assert a["collisionCount"]==1
a=m.parse(payload([resource(x) for x in names]+[resource("usageStatusShadow")]))
assert a["collisionCount"]==0
a=m.parse(payload([resource(x,"owner") if x=="usageStatus" else resource(x) for x in names]))
assert a["codebaseState"]=="CONFLICTING_LABELS"
def bad(items):
 try:m.parse(payload(items))
 except ValueError:return
 raise AssertionError("P102 bad inventory must fail closed")
bad(base[:-1])
bad(base[:2])
bad(base+[base[0]])
bad([resource(x,project="packtook-prod-01") for x in names])
bad(base+[{"name":"projects/packtook-staging/locations/us-central1/functions/x"}])
bad(base+[{"name":"projects/packtook-staging/locations/asia-southeast1/functions/../../bad"}])
bad(base+[{"name":"projects/packtook-staging/locations/asia-southeast1/functions/evil","labels":"not-an-object"}])
bad(base+[{"name":"projects/packtook-staging/locations/asia-southeast1/functions/evil","labels":{"firebase-functions-codebase":8}}])
bad([])
calls=[]
def mock(args):
 calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","list"]:
  assert "--v2" in args and "--regions=asia-southeast1" in args
  assert "--project=packtook-staging" in args
  assert "--limit=1000" in args
  return payload(base)
 raise AssertionError("P102 unexpected command")
r=m.inspect(mock)
assert r["stable"] and r["count"]==5 and r["collisionCount"]==0
assert len(calls)==3
def fail_project(args):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("P102 must stop before remote reads")
try:m.inspect(fail_project)
except ValueError as e:assert str(e)=="P102_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project not blocked")
def unstable(args):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 unstable.num+=1
 return payload(base if unstable.num==1 else base+[resource("extra123")])
unstable.num=0
assert not m.inspect(unstable)["stable"]
print("P102_HERMETIC_FUNCTION_INVENTORY_GUARD=PASS")
