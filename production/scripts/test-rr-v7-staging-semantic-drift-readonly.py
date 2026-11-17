#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).with_name("rr-v7-staging-semantic-drift-readonly.py")
spec=importlib.util.spec_from_file_location("sem",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_match(self):
  self.assertEqual(m.classify("index.html",b"a",b"a")[0],"MATCH")
 def test_html_changed_scripts_same(self):
  a=b'<html><script src="app.js?v=1"></script></html>'
  self.assertEqual(m.classify("index.html",a,a+b" ")[0],"INDEX_CONTENT_DRIFT_SCRIPTS_MATCH")
 def test_html_scripts_changed(self):
  a=b'<script src="app.js?v=1"></script>'
  b=b'<script src="app.js?v=2"></script>'
  self.assertEqual(m.classify("index.html",a,b)[0],"SCRIPT_TAGS_DIFFER")
 def test_bridge_missing_critical(self):
  a=b'api("reserveCredit");api("finalizeCredit");api("recordingStatus");api("recoverStaleVideoReservation");api("usageStatus");'
  b=b'api("reserveCredit");api("recordingStatus");'
  self.assertEqual(m.classify("firebase-packing-bridge.js",a,b)[0],"REQUIRED_CALLABLES_MISSING")
 def test_bridge_added_endpoint(self):
  a=b'api("reserveCredit");api("finalizeCredit");api("recordingStatus");api("recoverStaleVideoReservation");api("usageStatus");'
  b=a+b'api("newEndpoint");'
  self.assertEqual(m.classify("firebase-packing-bridge.js",a,b)[0],"BRIDGE_ENDPOINTS_EXTENDED")
 def test_line_summary_bounded(self):
  self.assertEqual(m.diff_summary(b"one\ntwo\n",b"one\nTHREE\n")[0],1)
 def test_raw_data_not_in_classification(self):
  secret="super-secret-DO-NOT-OUTPUT"
  a=b'api("reserveCredit");api("finalizeCredit");api("recordingStatus");api("recoverStaleVideoReservation");api("usageStatus");'
  status,parts=m.classify("firebase-packing-bridge.js",a,a+secret.encode())
  self.assertNotIn(secret,status+"".join(parts))
if __name__=="__main__":unittest.main()
