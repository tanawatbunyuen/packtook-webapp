#!/usr/bin/env python3
"""Offline V7 deployed bridge security-triage guard tests."""
import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).with_name("rr-v7-staging-bridge-security-triage-readonly.py")
spec=importlib.util.spec_from_file_location("triage",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_versions_without_exposing_unknown_query(self):
  a=b'<script src="firebase-packing-bridge.js?v=5.3.1"></script>'
  b=b'<script src="firebase-packing-bridge.js?v=5.4.0"></script>'
  lines=m.html_report(a,b)
  self.assertIn("DIFFERENCE_TYPE: VERSION_QUERY_ONLY",lines)
  self.assertIn("HOSTING_VERSION: v=5.4.0",lines)
 def test_nonstandard_query_hidden(self):
  self.assertEqual(m.safe_ver("token=SECRET_VALUE"),"NONSTANDARD_OR_UNSET")
 def test_script_origin_change_reported_without_url(self):
  a=b'<script src="a.js"></script>'
  b=b'<script src="https://example.com/private"></script>'
  report=" ".join(m.html_report(a,b))
  self.assertIn("SCRIPT_FILENAME_OR_ORIGIN_CHANGE",report)
  self.assertNotIn("example.com",report)
 def test_appcheck_added(self):
  source=b'import {initializeApp} from "firebase";\nconst app=initializeApp(firebaseConfig);'
  remote=source+b'\nconst x=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(key)});'
  before=m.check_bridge(source)
  after=m.check_bridge(remote)
  self.assertFalse(before["APP_CHECK_INITIALIZATION_CALL"])
  self.assertTrue(after["APP_CHECK_INITIALIZATION_CALL"])
  self.assertTrue(after["APP_CHECK_AFTER_APP_INITIALIZATION"])
 def test_order_failure(self):
  s=b'initializeAppCheck(app,{});\nconst app=initializeApp(config);'
  self.assertFalse(m.check_bridge(s)["APP_CHECK_AFTER_APP_INITIALIZATION"])
 def test_deployed_config_region_and_callable(self):
  s=b'import {firebaseConfig} from "./firebase-v4-config.js"; getFunctions(app,"asia-southeast1"); httpsCallable(x,y)'
  info=m.check_bridge(s)
  self.assertTrue(info["STAGING_CONFIG_IMPORT"])
  self.assertTrue(info["EXPECTED_FUNCTIONS_REGION"])
  self.assertTrue(info["CALLABLE_WRAPPER_PRESENT"])
 def test_unknown_script_version_does_not_leak(self):
  lines=m.html_report(b'<script src="a.js?v=1"></script>',b'<script src="a.js?secret=hello"></script>')
  self.assertNotIn("secret=hello",str(lines))
if __name__=="__main__":unittest.main()
