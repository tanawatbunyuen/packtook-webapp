#!/usr/bin/env python3
"""Offline lexical triage checks. No external calls."""
import importlib.util,pathlib,unittest,io
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-narrow-drift-triage-readonly.py")
spec=importlib.util.spec_from_file_location("narrow",p)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
def example(name="reserveCredit",code="return {recordingId:1};",suffix=""):
 s="const options={region:'asia-southeast1'};\n"
 for x in v.att.NAMES:
  content=code if x==name else "return {status:'ok'};"
  s+="exports."+x+"=onCall(options,async req=>{\n"+content+"\n});\n"
 return (s+suffix).encode()
class Checks(unittest.TestCase):
 def test_identical(self):
  self.assertEqual(v.token_equality("hello","hello"),"EXACT")
 def test_token_match_whitespace_heuristic(self):
  self.assertEqual(v.token_equality("return {a:1};","return  {a : 1} ;"),"TOKEN_SEQUENCE_EQUAL_HEURISTIC")
 def test_changed_identifier(self):
  self.assertEqual(v.token_equality("return current","return previous"),"TOKEN_SEQUENCE_DIFFERENT")
 def test_changed_constant(self):
  self.assertEqual(v.token_equality("return 1","return 0"),"TOKEN_SEQUENCE_DIFFERENT")
 def test_categories_from_diff(self):
  p=v.changed_line_profile("uid(req)\nreturn 1","return 1")
  self.assertIn("AUTH_TENANCY",p["security_categories"])
 def test_one_line_change(self):
  a=example();b=example(code="return {recordingId:2};")
  result=v.changed_line_profile(v.sem.handler(a,"reserveCredit"),v.sem.handler(b,"reserveCredit"))
  self.assertEqual(result["blocks"],1)
  self.assertEqual(result["line_count_change"],0)
 def test_shared_only(self):
  a=example(suffix="function helper(){return 1}")
  b=example(suffix="function helper(){return 2}")
  self.assertEqual(v.changed_line_profile(v.delta.masked_module(a),v.delta.masked_module(b))["blocks"],1)
 def test_print_no_source(self):
  a=example(code="return {recordingId:'secret42'};")
  b=example(code="return {recordingId:'secret43'};")
  buf=io.StringIO()
  with redirect_stdout(buf):v.report_one("reserveCredit",a,b)
  self.assertNotIn("secret42",buf.getvalue())
  self.assertNotIn("secret43",buf.getvalue())
  self.assertIn("TOKEN_EQUALITY_IS_SEMANTIC_PROOF: NO",buf.getvalue())
 def test_no_appcheck_proof(self):
  a=example()
  buf=io.StringIO()
  with redirect_stdout(buf):v.report_one("reserveCredit",a,a)
  self.assertIn("TOKEN_EQUALITY_IS_SEMANTIC_PROOF: NO",buf.getvalue())
if __name__=="__main__":unittest.main()
