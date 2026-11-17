#!/usr/bin/env python3
"""Offline test for sanitized AST subprocess results."""
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import Mock
p=pathlib.Path(__file__).with_name("rr-v7-ast-delta-review-readonly.py")
spec=importlib.util.spec_from_file_location("astbridge",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def payload():
 return {"handler":"EXACT_AST_TOKENS","counts":{s:{o:0 for o in m.OPS} for s in m.SCOPES},"selectedCurrent":{o:0 for o in m.OPS},"selectedOther":{o:0 for o in m.OPS}}
class Tests(unittest.TestCase):
 def test_valid_response(self):
  runner=Mock(return_value=Mock(returncode=0,stdout=json.dumps(payload()),stderr=""))
  x=m.analyze(b"abc",b"abc","usageStatus",runner)
  self.assertEqual(x["handler"],"EXACT_AST_TOKENS")
  self.assertNotIn("abc",runner.call_args.kwargs.get("args",[]))
  self.assertIn('"review": "abc"',runner.call_args.kwargs["input"])
 def test_reject_bad_scope(self):
  p=payload();del p["counts"]["TOP_LEVEL_BINDING"]
  with self.assertRaises(ValueError):
   m.analyze(b"",b"","usageStatus",Mock(return_value=Mock(returncode=0,stdout=json.dumps(p))))
 def test_reject_fake_success(self):
  with self.assertRaises(ValueError):
   m.analyze(b"",b"","usageStatus",Mock(return_value=Mock(returncode=0,stdout='{"handler":"PASS"}')))
 def test_reject_negative(self):
  p=payload();p["counts"]["CRITICAL_HELPER"]["MODIFIED"]=-1
  with self.assertRaises(ValueError):
   m.analyze(b"",b"","usageStatus",Mock(return_value=Mock(returncode=0,stdout=json.dumps(p))))
 def test_node_failure_sanitized(self):
  with self.assertRaises(ValueError):
   m.analyze(b"",b"","usageStatus",Mock(return_value=Mock(returncode=2,stdout="PRIVATE_SOURCE")))
 def test_reject_selected_total_mismatch(self):
  p=payload();p["selectedCurrent"]["MODIFIED"]=1
  with self.assertRaises(ValueError):
   m.analyze(b"",b"","usageStatus",Mock(return_value=Mock(returncode=0,stdout=json.dumps(p))))
 def test_five_staging_functions(self):
  self.assertEqual(len(m.att.NAMES),5)
if __name__=="__main__":unittest.main()
