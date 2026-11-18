#!/usr/bin/env python3
"""P80 tests: only synthetic pinned metadata, archives, and analyzer flags."""
import importlib.util
import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

script=Path(__file__).with_name("p80-staging-guard-source-readonly.py")
spec=importlib.util.spec_from_file_location("p80","{}".format(script))
p80=importlib.util.module_from_spec(spec)
spec.loader.exec_module(p80)

FOCUS=p80.FOCUS
NAMES=("recordingStatus","usageStatus","reserveCredit","finalizeCredit",
       "recoverStaleVideoReservation")
metadata={n:{"state":"ACTIVE","updateTime":"2026-11-18T00:00:00Z",
             "buildConfig":{"source":{"storageSource":{
                 "bucket":"gcf-v2-sources-123-asia-southeast1",
                 "object":"source.zip","generation":"100"}}}} for n in NAMES}
def snapshot_equal(before,after):
    return all(before.get(n)==after.get(n) for n in NAMES)
att=SimpleNamespace(
 stable_metadata=snapshot_equal,
 pinned_source=lambda x: ("b","o","g") if x and x.get("state")=="ACTIVE" else None,
 handler_from_zip=lambda b: b
)
def report(review,deployed):
    guarded=deployed==b"review"
    state="STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY" if guarded else "SECURITY_GUARD_DRIFT_REVIEW_REQUIRED"
    return {"state":state,**{n:{"reviewGuarded":True,"deployedGuarded":guarded} for n in FOCUS}}
st,rows=p80.evaluate(att,b"review",metadata,metadata,lambda pin:b"review",report)
assert st is True and rows==[(n,"MATCH_REVIEW_ONLY") for n in FOCUS]
st,rows=p80.evaluate(att,b"review",metadata,metadata,lambda pin:b"unguarded",report)
assert st and all(value=="DRIFT_REVIEW_REQUIRED" for _,value in rows)
changed={k:dict(v) for k,v in metadata.items()}
changed["usageStatus"]={**changed["usageStatus"],"updateTime":"2026-11-18T00:01:00Z"}
st,rows=p80.evaluate(att,b"review",metadata,changed,lambda pin:b"review",report)
assert st is False
missing={k:dict(v) for k,v in metadata.items()}
missing["usageStatus"]={"state":"NOT_ACTIVE"}
st,rows=p80.evaluate(att,b"review",missing,missing,lambda pin:b"review",report)
assert rows[1][1]=="NOT_VERIFIABLE"
def raises(*_):raise ValueError("malformed archive")
st,rows=p80.evaluate(att,b"review",metadata,metadata,raises,report)
assert all(v=="NOT_VERIFIABLE" for _,v in rows)

# Assert checkout refuses mismatched branch before reading source.
class Result:
    def __init__(self,code=0,stdout=""):
        self.returncode=code;self.stdout=stdout
def bad_branch(cmd,**kwargs):return Result(stdout="main\n")
try:p80.check_checkout(bad_branch)
except ValueError as exc:assert str(exc)=="REVIEW_BRANCH_NOT_PINNED"
else:raise AssertionError("wrong branch must fail")

# Gate must not print any service identity or archive URL in report.
assert "BACKEND_APP_CHECK=NOT_PROVEN" in script.read_text()
print("P80_OFFLINE_FIXTURE_MATRIX=PASS")
