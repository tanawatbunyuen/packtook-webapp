#!/usr/bin/env python3
"""Offline, no-cloud V7 deployed provenance inventory tests."""
import importlib.util,pathlib,unittest,json
from unittest.mock import patch
p=pathlib.Path(__file__).with_name("rr-v7-deployed-provenance-inventory-readonly.py")
spec=importlib.util.spec_from_file_location("v7prov",p);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class Fake:
 def __init__(self,code=0,output='{}'):
  self.returncode=code;self.stdout=output;self.stderr='SECRET_SHOULD_NOT_APPEAR'
class Checks(unittest.TestCase):
 def test_metadata_active(self):
  a=v.metadata({"state":"ACTIVE","updateTime":"time",
   "buildConfig":{"entryPoint":"reserveCredit","source":{"storageSource":{"bucket":"SECRET"}}},
   "serviceConfig":{"revision":"revision-name","secretEnvironmentVariables":[{"key":"SECRET"}]}})
  self.assertEqual(a["state"],"ACTIVE")
  self.assertTrue(a["source_metadata_present"])
  self.assertNotIn("SECRET",str(a))
  self.assertNotIn("revision-name",str(a))
 def test_missing_metadata(self):
  self.assertEqual(v.metadata(None),{"state":"DESCRIBE_FAILED"})
 def test_no_service_revision_not_failure(self):
  a=v.metadata({"state":"ACTIVE","buildConfig":{},"serviceConfig":{}})
  self.assertEqual(a["state"],"ACTIVE")
  self.assertFalse(a["revision_metadata_present"])
 def test_no_build_source_not_proven(self):
  self.assertFalse(v.metadata({"state":"ACTIVE","buildConfig":{"entryPoint":"run"}})["source_metadata_present"])
 def test_guard_rejects_wrong_project_before_cloud(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-prod-01"},clear=True):
   with self.assertRaises(ValueError):v.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("not called")))
 def test_guard_rejects_secret_env(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-staging","FIREBASE_TOKEN":"xyz"},clear=True):
   with self.assertRaises(ValueError):v.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("not called")))
 def test_describe_exactly_named_read_only(self):
  def runner(args,**kwargs):
   self.assertEqual(args[:3],["gcloud","functions","describe"])
   self.assertIn("--gen2",args)
   self.assertIn("--project=packtook-staging",args)
   self.assertIn("--region=asia-southeast1",args)
   return Fake(output=json.dumps({"state":"ACTIVE"}))
  self.assertEqual(v.describe("reserveCredit",runner)["state"],"ACTIVE")
 def test_failed_describe_returns_none_without_stderr(self):
  self.assertIsNone(v.describe("finalizeCredit",lambda *a,**k: Fake(code=1)))
 def test_function_list_exactly_five(self):
  self.assertEqual(len(v.NAMES),5)
  self.assertNotIn("createOmisePayment",v.NAMES)
if __name__=="__main__":unittest.main()
