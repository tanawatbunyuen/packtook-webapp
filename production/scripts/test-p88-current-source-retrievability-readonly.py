#!/usr/bin/env python3
"""P88 synthetic pinned archive read tests. Never invokes gcloud."""
import importlib.util
from pathlib import Path
script=Path(__file__).with_name("p88-current-source-retrievability-readonly.py")
spec=importlib.util.spec_from_file_location("p88",script)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Fake:
    NAMES=("recordingStatus","usageStatus","reserveCredit","finalizeCredit","recoverStaleVideoReservation")
    def __init__(self,mode="ok"):
        self.mode=mode;self.calls=[];self.round=0
    def function_metadata(self,name):
        self.calls.append(("metadata",name))
        if name==self.NAMES[0]:self.round+=1
        if self.mode=="missing":return None
        rev="a" if self.mode!="drift" or self.round==1 else "b"
        return {"source":"demo","rev":rev}
    def pinned_source(self,info):
        return ("bucket","archive.zip","1") if info and self.mode!="unpinned" else None
    def bounded_archive(self,pin):
        self.calls.append(("download",pin))
        if self.mode=="archive_error":raise ValueError("redacted")
        return b"fake source"
    def handler_from_zip(self,data):
        if self.mode=="invalid_handler":raise ValueError("invalid")
        return b"exports.usageStatus=1;"
    def stable_metadata(self,a,b):
        return a==b
for name in m.NAMES:
    f=Fake()
    status,stable=m.verify(f,name)
    assert status=="CURRENT_PINNED_ARCHIVE_READABLE_ONLY" and stable
    assert len([x for x in f.calls if x[0]=="download"])==1
    assert len([x for x in f.calls if x[0]=="metadata"])==10
for mode,expected in [("missing","NOT_VERIFIABLE"),("unpinned","NOT_VERIFIABLE"),
                       ("archive_error","NOT_VERIFIABLE"),("invalid_handler","NOT_VERIFIABLE"),
                       ("drift","METADATA_DRIFT_REVIEW_REQUIRED")]:
    f=Fake(mode)
    state,_=m.verify(f,m.NAMES[0])
    assert state==expected,(mode,state)
try:m.verify(Fake(),"reserveCredit")
except ValueError as err:assert str(err)=="P88_OUT_OF_SCOPE"
else:raise AssertionError("credit function must never be inspected")
print("P88_SYNTHETIC_ARCHIVE_READ_MATRIX=PASS")
