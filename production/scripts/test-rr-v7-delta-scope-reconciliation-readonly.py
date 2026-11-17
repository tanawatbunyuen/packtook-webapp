#!/usr/bin/env python3
"""Offline tests for declaration-operation counts. No cloud access."""
import importlib.util
import io
import pathlib
import unittest
from contextlib import redirect_stdout
path=pathlib.Path(__file__).with_name("rr-v7-delta-scope-reconciliation-readonly.py")
spec=importlib.util.spec_from_file_location("v7scope",path)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)

def code(other="exports.other=onCall(options,async req=>{\nreturn 1;\n});",
         status="const x=1;",helper="function uid(req){return req.auth.uid;}",
         new_bind=""):
 lines=["const options={region:'asia-southeast1'};",helper]
 for name in v.att.NAMES:
  body=status if name=="recordingStatus" else "const x=1;"
  lines.append("exports."+name+"=onCall(options,async req=>{\n "+body+"\n});")
 lines.append(other)
 if new_bind:lines.append(new_bind)
 return ("\n".join(lines)+"\n").encode()

class Tests(unittest.TestCase):
 def test_exact_no_operations(self):
  a=code()
  self.assertEqual(v.operations(a,a),[])
 def test_other_export_modified(self):
  a=code()
  b=code(other="exports.other=onCall(options,async req=>{\nreturn 2;\n});")
  self.assertIn(("OTHER_EXPORTED_FUNCTION","MODIFIED"),v.operations(a,b))
 def test_other_export_added(self):
  a=code(other="")
  b=code()
  self.assertIn(("OTHER_EXPORTED_FUNCTION","DEPLOYED_ONLY"),v.operations(a,b))
 def test_other_export_review_only(self):
  a=code()
  b=code(other="")
  self.assertIn(("OTHER_EXPORTED_FUNCTION","REVIEW_ONLY"),v.operations(a,b))
 def test_handler_modified(self):
  a=code()
  b=code(status="const x=2;")
  self.assertIn(("SELECTED_HANDLER","MODIFIED"),v.operations(a,b))
 def test_critical_helper_modified(self):
  a=code()
  b=code(helper="function uid(req){return req.auth.email;}")
  self.assertIn(("CRITICAL_HELPER","MODIFIED"),v.operations(a,b))
 def test_new_binding(self):
  a=code()
  b=code(new_bind="const more=true;")
  self.assertIn(("TOP_LEVEL_BINDING","DEPLOYED_ONLY"),v.operations(a,b))
 def test_private_name_redacted(self):
  a=code()
  b=code(new_bind="const PRIVATE_SECRET_KEY='SENSITIVE_VALUE';")
  out=io.StringIO()
  with redirect_stdout(out):v.detail(a,b,"reserveCredit")
  self.assertNotIn("PRIVATE_SECRET_KEY",out.getvalue())
  self.assertNotIn("SENSITIVE_VALUE",out.getvalue())
  self.assertIn("FUNCTION_GATE: REVIEW_REQUIRED",out.getvalue())
 def test_no_semantic_clearance(self):
  a=code()
  out=io.StringIO()
  with redirect_stdout(out):v.detail(a,a,"usageStatus")
  self.assertIn("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN",out.getvalue())
 def test_five_sources(self):
  self.assertEqual(len(v.att.NAMES),5)
if __name__=="__main__":unittest.main()
