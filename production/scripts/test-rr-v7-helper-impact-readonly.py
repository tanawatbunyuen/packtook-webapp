#!/usr/bin/env python3
"""Offline-only regression checks for fixed-name helper impact triage."""
import importlib.util, pathlib, unittest, io
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-helper-impact-readonly.py")
spec=importlib.util.spec_from_file_location("impact",p)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
def source(helper="return 1;",response="return {status:'ok'};"):
    src=("function uid(req){"+helper+"}\n"+
         "function ownerRef(id){return id;}\n"+
         "const options={region:'asia-southeast1'};\n")
    for name in v.att.NAMES:
        src+="exports."+name+"=onCall(options,async req=>{\n"+response+"\n});\n"
    return src.encode()
class Tests(unittest.TestCase):
 def test_helper_exact(self):
  a=source()
  self.assertEqual(v.helper_status(a,a,"uid"),"EXACT")
 def test_helper_drift(self):
  self.assertEqual(v.helper_status(source(),source(helper="return 2;"),"uid"),"DRIFT")
 def test_missing_helper_not_verifiable(self):
  self.assertEqual(v.helper_status(source(),source(),"walletEnabled"),"NOT_VERIFIABLE")
 def test_helper_span_ignores_inline_non_declaration(self):
  self.assertIsNone(v.helper_span(b"// function uid(req) {}\n", "uid"))
 def test_response_exact(self):
  a=source()
  self.assertEqual(v.handler_response_status(a,a,"recordingStatus"),"EXACT")
 def test_response_sensitive(self):
  self.assertEqual(v.handler_response_status(source(),source(response="return {status:'changed'};"),"usageStatus"),"CHECK_RELATED_LINE_DRIFT")
 def test_response_noncheck_line(self):
  a=source(response="const unused=1;\nreturn {status:'ok'};")
  b=source(response="const unused=2;\nreturn {status:'ok'};")
  self.assertEqual(v.handler_response_status(a,b,"recordingStatus"),"NON_CHECK_LINE_DRIFT")
 def test_report_does_not_reveal_source(self):
  a=source(helper="const DONT_PRINT_SECRET='key';return 1;")
  b=source(helper="const DONT_PRINT_SECRET='different';return 1;")
  buf=io.StringIO()
  with redirect_stdout(buf):v.impact_report(a,b,"reserveCredit")
  self.assertNotIn("DONT_PRINT_SECRET",buf.getvalue())
  self.assertIn("HELPER_UID: DRIFT",buf.getvalue())
 def test_scope_five(self):
  self.assertEqual(set(v.TARGETS),set(v.att.NAMES))
if __name__=="__main__":unittest.main()
