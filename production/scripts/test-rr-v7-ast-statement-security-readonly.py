#!/usr/bin/env python3
"""Synthetic, offline-only tests for PACKTOOK V7 statement bridge."""
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import Mock
P=pathlib.Path(__file__).with_name("rr-v7-ast-statement-security-readonly.py")
spec=importlib.util.spec_from_file_location("statements",P)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)

def example(name="recordingStatus",drift=False):
 result={"name":name,"status":"DRIFT_REVIEW_REQUIRED" if drift else "EXACT_STATEMENT_TOKENS",
 "operations":{k:(1 if k=="MODIFIED" and drift else 0) for k in v.OPS},
 "statementTypes":{k:0 for k in v.TYPES},
 "categories":{k:0 for k in v.CATEGORIES},
 "changedBlocks":1 if drift else 0,"ambiguousBlocks":0,
 "categoryCoverage":"HEURISTIC_SIGNALS_ONLY" if drift else "NO_DIFFERENCES",
 "conclusion":"FUNCTIONAL_EQUIVALENCE_NOT_PROVEN"}
 return result
def runner(value):
 return Mock(return_value=Mock(returncode=0,stdout=json.dumps(value)))
class Tests(unittest.TestCase):
 def test_accept_exact(self):
  self.assertEqual(v.analyze(b"abc",b"def","recordingStatus",runner(example()))["changedBlocks"],0)
 def test_accept_drift(self):
  self.assertEqual(v.analyze(b"abc",b"def","recordingStatus",runner(example(drift=True)))["changedBlocks"],1)
 def test_fail_closed_inconsistent_count(self):
  a=example(drift=True);a["operations"]["MODIFIED"]=0
  with self.assertRaises(ValueError):v.analyze(b"",b"","recordingStatus",runner(a))
 def test_fail_closed_fake_clearance(self):
  a=example();a["conclusion"]="PASSED"
  with self.assertRaises(ValueError):v.analyze(b"",b"","recordingStatus",runner(a))
 def test_fail_closed_excess_categories(self):
  a=example();a["categories"]["ARBITRARY_SECRET"]=1
  with self.assertRaises(ValueError):v.analyze(b"",b"","recordingStatus",runner(a))
 def test_block_unknown_function(self):
  with self.assertRaises(ValueError):v.analyze(b"",b"","reserveCredit",runner(example()))
 def test_node_errors_sanitized(self):
  with self.assertRaises(ValueError):
   v.analyze(b"",b"","usageStatus",Mock(return_value=Mock(returncode=2,stdout="PRIVATE_SOURCE")))
 def test_no_source_in_stdout(self):
  from contextlib import redirect_stdout
  import io
  output=io.StringIO()
  with redirect_stdout(output):v.emit("recordingStatus",example(drift=True))
  self.assertNotIn("PRIVATE_SOURCE",output.getvalue())
  self.assertIn("FUNCTION_GATE: REVIEW_REQUIRED",output.getvalue())
 def test_request_stdin_not_argv(self):
  x=Mock(return_value=Mock(returncode=0,stdout=json.dumps(example())))
  v.analyze(b"secret_review",b"secret_remote","recordingStatus",x)
  self.assertIn("secret_remote",x.call_args.kwargs["input"])
  self.assertNotIn("secret_remote",str(x.call_args.args))
 def test_exactly_two_handlers(self):
  self.assertEqual(v.NAMES,("recordingStatus","usageStatus"))
if __name__=="__main__":unittest.main()
