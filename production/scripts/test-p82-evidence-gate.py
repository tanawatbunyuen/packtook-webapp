#!/usr/bin/env python3
"""P82 offline fixture tests; no cloud, credentials or deployment."""
import importlib.util
from pathlib import Path
p=Path(__file__).with_name("p82-evidence-gate.py")
s=importlib.util.spec_from_file_location("p82",p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def fixture(left="DRIFT_REVIEW_REQUIRED",right="DRIFT_REVIEW_REQUIRED",stable="YES",gate="REVIEW_REQUIRED",exitcode="2"):
    return f"""FUNCTION=recordingStatus
  GUARDED_SOURCE={left}
FUNCTION=usageStatus
  GUARDED_SOURCE={right}
P80_ALL_FIVE_REVISION_STABLE={stable}
P80_GUARD_SOURCE_GATE={gate}
P80_BACKEND_APP_CHECK=NOT_PROVEN
P80_IAM_LEAST_PRIVILEGE=NOT_VERIFIED
P80_CLOUD_WRITES=0
P80_DEPLOY=0
P80_RELEASE=NO_GO_RELEASE
P80_EXIT_CODE={exitcode}
P80_DIAGNOSTIC_COMPLETE
"""
assert m.classify(fixture())["guard"]=="REVIEW_REQUIRED"
assert m.classify(fixture("MATCH_REVIEW_ONLY","MATCH_REVIEW_ONLY",gate="MATCH_REVIEW_ONLY",exitcode="0"))["guard"]=="MATCH_REVIEW_ONLY"
assert not m.classify(fixture(stable="NOT_VERIFIABLE"))["stable"]
bad=[
fixture().replace("P80_CLOUD_WRITES=0","P80_CLOUD_WRITES=1"),
fixture().replace("NOT_PROVEN","TRUE"),
fixture().replace("P80_GUARD_SOURCE_GATE=REVIEW_REQUIRED","P80_GUARD_SOURCE_GATE=MATCH_REVIEW_ONLY"),
fixture().replace("FUNCTION=usageStatus","FUNCTION=unexpectedFunction"),
fixture().replace("P80_EXIT_CODE=2","P80_EXIT_CODE=0")]
for raw in bad:
    try:m.classify(raw)
    except ValueError:pass
    else:raise AssertionError("Evidence must fail closed")
print("P82_OFFLINE_FIXTURE_MATRIX=8/8 PASS")
