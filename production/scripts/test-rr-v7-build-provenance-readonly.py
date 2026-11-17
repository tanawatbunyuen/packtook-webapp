#!/usr/bin/env python3
import importlib.util,pathlib,unittest
from unittest.mock import patch
p=pathlib.Path(__file__).with_name("rr-v7-build-provenance-readonly.py")
spec=importlib.util.spec_from_file_location("bprov",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
VALID="projects/689946391888/locations/asia-southeast1/builds/01234567-89ab-cdef-0123-456789abcdef"
class Fake:
 def __init__(self,code=0,text="{}"):
  self.returncode=code;self.stdout=text;self.stderr="SECRET"
class Tests(unittest.TestCase):
 def test_build_reference(self):
  self.assertEqual(m.build_locator({"buildConfig":{"build":VALID}}),"01234567-89ab-cdef-0123-456789abcdef")
 def test_wrong_region_blocked(self):
  self.assertIsNone(m.build_locator({"buildConfig":{"build":VALID.replace("asia-southeast1","us-central1")}}))
 def test_unsafe_reference_blocked(self):
  self.assertIsNone(m.build_locator({"buildConfig":{"build":"https://example.com/"}}))
 def test_resolved_repo_hint(self):
  self.assertEqual(m.evidence({"sourceProvenance":{"resolvedRepoSource":{"commitSha":"a"*40}}}),"RESOLVED_REPO_COMMIT_HINT")
 def test_substitution_is_only_hint(self):
  self.assertEqual(m.evidence({"substitutions":{"COMMIT_SHA":"b"*40}}),"BUILD_SUBSTITUTION_COMMIT_HINT")
 def test_no_commit_proof(self):
  self.assertEqual(m.evidence({"status":"SUCCESS"}),"NO_COMMIT_PROVENANCE")
 def test_unknown_build(self):
  self.assertEqual(m.evidence(None),"BUILD_NOT_READABLE")
 def test_env_guard_wrong_project(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-prod-01"},clear=True):
   with self.assertRaises(ValueError):
    m.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("must not call")))
 def test_env_guard_unsafe(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-staging","FIREBASE_TOKEN":"dummy"},clear=True):
   with self.assertRaises(ValueError):
    m.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("must not call")))
 def test_read_only_query(self):
  def runner(args,**kw):
   self.assertEqual(args[:3],["gcloud","builds","describe"])
   self.assertIn("--project=packtook-staging",args)
   self.assertIn("--region=asia-southeast1",args)
   return Fake(text='{"status":"SUCCESS"}')
  self.assertEqual(m.json_get(["gcloud","builds","describe","x","--project=packtook-staging","--region=asia-southeast1"],runner)["status"],"SUCCESS")
 def test_five_functions_scope(self):
  self.assertEqual(len(m.NAMES),5)
  self.assertEqual(m.PROJECT,"packtook-staging")
if __name__=="__main__":unittest.main()
