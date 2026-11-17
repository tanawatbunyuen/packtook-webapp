#!/usr/bin/env python3
"""P61 mocked staging revision stability checks; never calls gcloud."""
import importlib.util, pathlib, unittest
p=pathlib.Path(__file__).with_name("rr-v7-deployed-source-attestation-readonly.py")
spec=importlib.util.spec_from_file_location("p61_source",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
def meta(gen="1700000000000000",timestamp="2026-11-17T12:00:00Z",state="ACTIVE"):
 return {"state":state,"updateTime":timestamp,"buildConfig":{"source":{"storageSource":{
 "bucket":"gcf-v2-sources-12345-asia-southeast1","object":"source.zip","generation":gen}}}}
def snap():
 return {name:meta() for name in m.NAMES}
class Stability(unittest.TestCase):
 def test_all_unchanged(self):
  a=snap()
  self.assertTrue(m.stable_metadata(a,snap()))
 def test_generation_rollover_blocks(self):
  a,b=snap(),snap()
  b["usageStatus"]=meta(gen="1700000000000001")
  self.assertFalse(m.stable_metadata(a,b))
 def test_timestamp_rollover_blocks(self):
  a,b=snap(),snap()
  b["recordingStatus"]=meta(timestamp="2026-11-17T12:01:00Z")
  self.assertFalse(m.stable_metadata(a,b))
 def test_missing_target_blocks(self):
  a,b=snap(),snap()
  del b["reserveCredit"]
  self.assertFalse(m.stable_metadata(a,b))
 def test_deploying_blocks(self):
  a,b=snap(),snap()
  b["finalizeCredit"]=meta(state="DEPLOYING")
  self.assertFalse(m.stable_metadata(a,b))
 def test_missing_update_time_blocks(self):
  a,b=snap(),snap()
  del b["usageStatus"]["updateTime"]
  self.assertFalse(m.stable_metadata(a,b))
 def test_empty_update_time_blocks(self):
  a,b=snap(),snap()
  a["usageStatus"]["updateTime"]=""
  self.assertFalse(m.stable_metadata(a,b))
if __name__=="__main__": unittest.main()
