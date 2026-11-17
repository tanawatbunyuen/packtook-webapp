#!/usr/bin/env python3
"""Offline only; verifies V7 triage classification and nonmutating gates."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch
p=pathlib.Path(__file__).with_name("rr-v7-staging-hosting-drift-triage-readonly.py")
spec=importlib.util.spec_from_file_location("drift",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class TestDrift(unittest.TestCase):
 def test_identical_is_match(self):
  for asset,markers in m.ASSET_MARKERS.items():
   value=b"/".join(markers)
   self.assertEqual(m.classify_asset(asset,value,value),"MATCH")
 def test_other_build(self):
  for asset,markers in m.ASSET_MARKERS.items():
   remote=b"/".join(markers)+b"v2"
   self.assertEqual(m.classify_asset(asset,b"v1",remote),"DIFFERENT_PACKTOOK_BUILD")
 def test_unexpected_page(self):
  self.assertEqual(m.classify_asset("index.html",b"staging",b"<html>other page</html>"),"UNEXPECTED_HTML_PAGE")
 def test_missing_script_bridge(self):
  self.assertEqual(m.classify_asset("firebase-packing-bridge.js",b"real",b"unrelated"),"UNEXPECTED_CONTENT")
 def test_sha_len_and_stability(self):
  self.assertEqual(len(m.safe_fingerprint(b"hello")),12)
  self.assertEqual(m.safe_fingerprint(b"hello"),m.safe_fingerprint(b"hello"))
 def test_refuses_unsafe_environment(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-prod-01"},clear=True):
   with self.assertRaisesRegex(ValueError,"PROJECT_GUARD"):
    m.verify_env()
 def test_refuses_credentials(self):
  with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-staging","FIREBASE_TOKEN":"nonempty"},clear=True):
   with self.assertRaisesRegex(ValueError,"UNSAFE_ENV"):
    m.verify_env()
 def test_asset_list_complete(self):
  self.assertEqual(set(m.ASSET_MARKERS),set(m.mod.ASSETS))
if __name__=="__main__":unittest.main()
