#!/usr/bin/env python3
"""Offline guard tests for V7 Hosting blocked-reason diagnostic."""
import importlib.util
import pathlib
import unittest
import urllib.error
from unittest.mock import patch
p=pathlib.Path(__file__).with_name("rr-v7-hosting-blocker-diagnostic-readonly.py")
spec=importlib.util.spec_from_file_location("v7diag",p)
d=importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
class Checks(unittest.TestCase):
 def test_http_404(self):self.assertEqual(d.kind(urllib.error.HTTPError("",404,"",{},None)),"HTTP_404")
 def test_http_403(self):self.assertEqual(d.kind(urllib.error.HTTPError("",403,"",{},None)),"HTTP_ACCESS_DENIED")
 def test_dns_failure(self):self.assertEqual(d.kind(urllib.error.URLError("fake")),"NETWORK_OR_DNS")
 def test_missing_local_file(self):self.assertEqual(d.kind(FileNotFoundError()),"LOCAL_FILE_MISSING")
 def test_project_guard(self):self.assertEqual(d.kind(ValueError("PROJECT_GUARD")),"PROJECT_GUARD")
 def test_no_arbitrary_value_leak(self):self.assertEqual(d.kind(ValueError("SECRET_PRIVATE")),"VALIDATION_ERROR")
 def test_no_gcloud_when_env_missing(self):
  with patch.dict("os.environ",{},clear=True):
   with patch.object(d.subprocess,"check_output",side_effect=AssertionError("should never call")):
    self.assertEqual(d.guarded(),2)
if __name__=="__main__":unittest.main()
