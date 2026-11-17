#!/usr/bin/env python3
"""Offline callable-wrapper bridge fail-closed contract checks."""
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import Mock
p=pathlib.Path(__file__).with_name("rr-v7-callable-wrapper-appcheck-readonly.py")
spec=importlib.util.spec_from_file_location("wrap_bridge",p)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)

def payload(name="recordingStatus"):
 return {"name":name,"callableCallee":"EXACT_CALLEE_TOKENS",
 "callbackHeader":"EXACT_CALLBACK_HEADER_TOKENS",
 "optionsArgument":"EXACT_OPTIONS_ARGUMENT_TOKENS",
 "sourceAppCheck":"NO_ENFORCEMENT_LITERAL_IN_OPTIONS",
 "deployedAppCheck":"NO_ENFORCEMENT_LITERAL_IN_OPTIONS",
 "directOnCallBoth":True,
 "moduleEffects":"NOT_REVIEWED","backendEnforcement":"NOT_PROVEN",
 "functionalEquivalence":"NOT_PROVEN","functionGate":"REVIEW_REQUIRED"}
def runner(value):
 return Mock(return_value=Mock(returncode=0,stdout=json.dumps(value)))
class Tests(unittest.TestCase):
 def test_exact(self):
  self.assertEqual(v.analyze(b"a",b"b","recordingStatus",runner(payload()))["functionGate"],"REVIEW_REQUIRED")
 def test_explicit_true_not_enforcement_proof(self):
  x=payload();x["deployedAppCheck"]="TRUE_LITERAL_IN_OPTIONS"
  self.assertEqual(v.analyze(b"",b"","recordingStatus",runner(x))["backendEnforcement"],"NOT_PROVEN")
 def test_unrecognized_gate_rejected(self):
  x=payload();x["backendEnforcement"]="PROVEN"
  with self.assertRaises(ValueError):v.analyze(b"",b"","recordingStatus",runner(x))
 def test_unrecognized_enum_rejected(self):
  x=payload();x["deployedAppCheck"]="APP_CHECK_PASS"
  with self.assertRaises(ValueError):v.analyze(b"",b"","recordingStatus",runner(x))
 def test_wrong_function_rejected(self):
  with self.assertRaises(ValueError):v.analyze(b"",b"","usageStatus",runner(payload()))
 def test_extra_fields_rejected(self):
  x=payload();x["private"]="SENSITIVE"
  with self.assertRaises(ValueError):v.analyze(b"",b"","recordingStatus",runner(x))
 def test_wrong_bool_type_rejected(self):
  x=payload();x["directOnCallBoth"]="true"
  with self.assertRaises(ValueError):v.analyze(b"",b"","recordingStatus",runner(x))
 def test_subprocess_failure_rejected(self):
  with self.assertRaises(ValueError):
   v.analyze(b"",b"","recordingStatus",Mock(return_value=Mock(returncode=2,stdout="PRIVATE_DATA")))
 def test_source_sent_stdin_only(self):
  x=Mock(return_value=Mock(returncode=0,stdout=json.dumps(payload())))
  v.analyze(b"SECRET_A",b"SECRET_B","recordingStatus",x)
  self.assertIn("SECRET_B",x.call_args.kwargs["input"])
  self.assertNotIn("SECRET_B",str(x.call_args.args))
 def test_only_two_target_functions(self):
  self.assertEqual(v.NAMES,("recordingStatus","usageStatus"))
if __name__=="__main__":unittest.main()
