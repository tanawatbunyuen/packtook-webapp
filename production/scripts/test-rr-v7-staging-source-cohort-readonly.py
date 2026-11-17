#!/usr/bin/env python3
"""Offline tests; never query Cloud Functions."""
import importlib.util, pathlib, unittest, json
from unittest.mock import patch
p=pathlib.Path(__file__).with_name("rr-v7-staging-source-cohort-readonly.py")
spec=importlib.util.spec_from_file_location("cohort",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def obj(generation="42",object_name="functions.zip"):
 return {"state":"ACTIVE","buildConfig":{"source":{"storageSource":
    {"bucket":"private-bucket","object":object_name,"generation":generation}}}}
class Fake:
 def __init__(self,data=None,status=0):
  self.stdout=json.dumps(data if data is not None else {})
  self.stderr="SECRET"
  self.returncode=status
class Checks(unittest.TestCase):
 def test_storage_identical(self):
  self.assertEqual(m.summarize([obj()]*5),"SAME_SOURCE_ARTIFACT")
 def test_storage_generation_mismatch(self):
  self.assertEqual(m.summarize([obj()]*4+[obj(generation="43")]),"MULTIPLE_SOURCE_ARTIFACTS")
 def test_storage_path_mismatch(self):
  self.assertEqual(m.summarize([obj()]*4+[obj(object_name="other.zip")]),"MULTIPLE_SOURCE_ARTIFACTS")
 def test_missing_generation_blocked(self):
  self.assertIsNone(m.source_identity({"buildConfig":{"source":{"storageSource":{"bucket":"x","object":"y"}}}}))
  self.assertEqual(m.summarize([obj()]*4+[{}]),"SOURCE_IDENTITY_INCOMPLETE")
 def test_repo_source_identity(self):
  value={"buildConfig":{"source":{"repoSource":{"projectId":"p","repoName":"r","commitSha":"abc"}}}}
  self.assertEqual(m.source_identity(value),("REPO_COMMIT_SOURCE","p","r","abc"))
 def test_no_sensitive_print(self):
  from io import StringIO
  from contextlib import redirect_stdout
  buf=StringIO()
  with redirect_stdout(buf):m.report([obj()]*5)
  out=buf.getvalue()
  self.assertNotIn("private-bucket",out)
  self.assertNotIn("functions.zip",out)
  self.assertIn("SAME_SOURCE_ARTIFACT",out)
  self.assertIn("APP_CHECK_ENFORCEMENT: NOT_PROVEN",out)
 def test_guard_reject_prod(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-prod-01"},clear=True):
   with self.assertRaises(ValueError):m.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("called")))
 def test_guard_reject_secret(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-staging","FIREBASE_TOKEN":"secret"},clear=True):
   with self.assertRaises(ValueError):m.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("called")))
 def test_describe_staging_only(self):
  def runner(args,**kw):
   self.assertEqual(args[:3],["gcloud","functions","describe"])
   self.assertIn("--project=packtook-staging",args)
   self.assertIn("--gen2",args)
   return Fake(obj())
  self.assertEqual(m.describe("reserveCredit",runner)["state"],"ACTIVE")
 def test_callables_list_exact(self):
  self.assertEqual(len(m.NAMES),5)
  self.assertNotIn("createOmisePayment",m.NAMES)
if __name__=="__main__":unittest.main()
