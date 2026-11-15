#!/usr/bin/env python3
import importlib.util
import pathlib
import unittest
path=pathlib.Path(__file__).with_name("rr-omise-support-evidence.py")
spec=importlib.util.spec_from_file_location("evidence",path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
LOG="""2026-11-15 13:28:30 OMISE_TEST_READ_ONLY_VERIFIED: FAIL
2026-11-15 13:28:30 FAILURE_CATEGORY: PROVIDER_HTTP_NOT_SUCCESS
2026-11-15 13:28:30 PROVIDER_HTTP_STATUS: 404
2026-11-15 13:28:30 PROVIDER_ERROR_CODE: not_found
2026-11-15 SECRET_EXAMPLE: skey_test_fakeABC789
2026-11-15 Authorization: Basic TEST_CREDENTIAL_DUMMY
2026-11-15 metadata: uid=private_identifier
"""
class EvidenceTest(unittest.TestCase):
 def test_real_shape(self):
  result=module.sanitized(LOG,"packtook-omise-test-probe-q8g8x")
  self.assertEqual((result["verification"],result["http_status"],result["provider_code"]),("FAIL","404","not_found"))
 def test_no_secrets_in_output(self):
  note=module.render(module.sanitized(LOG,"packtook-omise-test-probe-q8g8x"))
  for value in ("skey_test_fakeABC789","TEST_CREDENTIAL_DUMMY","private_identifier","uid="):
   self.assertNotIn(value,note)
 def test_unknown_code_redacted(self):
  result=module.sanitized(LOG.replace("not_found","skey_live_DO_NOT_COPY"),
    "packtook-omise-test-probe-q8g8x")
  self.assertEqual(result["provider_code"],"OTHER_REDACTED")
 def test_unknown_status_redacted(self):
  result=module.sanitized(LOG.replace("STATUS: 404","STATUS: skey_test_DO_NOT_COPY"),
   "packtook-omise-test-probe-q8g8x")
  self.assertEqual(result["http_status"],"OTHER_REDACTED")
 def test_wrong_execution_rejected(self):
  with self.assertRaises(ValueError):module.sanitized(LOG,"packtook-prod-01")
 def test_oversized_log_rejected(self):
  with self.assertRaises(ValueError):module.sanitized(LOG+"A"*20000,"packtook-omise-test-probe-q8g8x")
 def test_missing_status_rejected(self):
  with self.assertRaises(ValueError):module.sanitized("Authorization: Basic private","packtook-omise-test-probe-q8g8x")
 def test_sample_404_support_request(self):
  note=module.render(module.sanitized(LOG,"packtook-omise-test-probe-q8g8x"))
  self.assertIn("GET https://api.omise.co/charges/{id}",note)
  self.assertIn("HTTP status: 404",note)
  self.assertIn("No production deploy",note)
if __name__=="__main__":unittest.main()
