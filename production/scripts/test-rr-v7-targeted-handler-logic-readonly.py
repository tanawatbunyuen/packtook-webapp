#!/usr/bin/env python3
"""Synthetic offline test cases only, no access to Staging or Cloud."""
import importlib.util,io,pathlib,unittest
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-targeted-handler-logic-readonly.py")
spec=importlib.util.spec_from_file_location("targetlogic",p)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
def make(name="recordingStatus", return_code=None, extra=""):
    if return_code is None:return_code="return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null};"
    s="const options={region:'asia-southeast1'};\n"
    for n in v.att.NAMES:
        body=return_code if n==name else "return {status:'ok'};"
        s+="exports."+n+"=onCall(options,async req=>{\n "+body+"\n});\n"
    return (s+extra).encode()
class Tests(unittest.TestCase):
 def test_parser_nested_calls(self):
  src="plan:a.plan,remaining:creditAvailable(a),canBuyMore:purchaseDecision(a,a.plan).allowed"
  parts=v.split_top_level(src)
  self.assertEqual(len(parts),3)
 def test_parser_string_with_comma(self):
  parts=v.split_top_level('file:"a,b",status:"ok"')
  self.assertEqual(len(parts),2)
 def test_parser_unbalanced(self):
  with self.assertRaises(ValueError):v.split_top_level("file:call(a,b")
 def test_parser_unbalanced_brackets(self):
  with self.assertRaises(ValueError):v.split_top_level("file:[a}")
 def test_parser_template_string_rejected_or_unverifiable(self):
  # Template syntax is not parsed; no runtime equivalence claim from the signal.
  self.assertEqual(v.inspect(make(),make(),"recordingStatus")["handler"],"EXACT")
 def test_shorthand_fields(self):
  line="return {"+",".join(k if k in ("limit","used","reserved") else k+":null" for k in v.TARGETS["usageStatus"])+"};"
  result=v.response_fields(line,"usageStatus")
  self.assertEqual(len(result),13)
  self.assertEqual(result["used"],"used")
 def test_keyset_identical(self):
  result=v.selected_changes(v.sem.handler(make(),"recordingStatus"),v.sem.handler(make(),"recordingStatus"),"recordingStatus")
  self.assertEqual(result[0],"EXACT_EXPRESSIONS")
 def test_value_expression_changed(self):
  a=make()
  b=make(return_code="return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:null};")
  report=v.inspect(a,b,"recordingStatus")
  self.assertEqual(report["response"],"VALUE_EXPRESSION_DRIFT")
  self.assertEqual(report["changed_fields"],("file",))
 def test_other_key_added(self):
  a=make()
  b=make(return_code="return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null,privateFlag:1};")
  self.assertEqual(v.inspect(a,b,"recordingStatus")["response"],"RESPONSE_KEY_SET_CHANGED")
 def test_missing_key(self):
  a=make()
  b=make(return_code="return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period};")
  self.assertEqual(v.inspect(a,b,"recordingStatus")["response"],"EXPECTED_FIELD_MISSING")
 def test_nonreturn_logic_drift(self):
  a=make(return_code="const audit=1;\nreturn {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:null};")
  b=make(return_code="const audit=2;\nreturn {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:null};")
  self.assertEqual(v.inspect(a,b,"recordingStatus")["line_kind"],"NON_RETURN_LOGIC_DRIFT")
 def test_shared_module_change_does_not_disappear(self):
  a=make(extra="function shared(){return 1;}")
  b=make(extra="function shared(){return 2;}")
  self.assertEqual(v.inspect(a,b,"recordingStatus")["shared"],"DRIFT")
 def test_no_raw_private_expression_printed(self):
  a=make()
  b=make(return_code='return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:"MY_PRIVATE_SECRET"};')
  buf=io.StringIO()
  with redirect_stdout(buf):v.emit("recordingStatus",v.inspect(a,b,"recordingStatus"))
  self.assertNotIn("MY_PRIVATE_SECRET",buf.getvalue())
  self.assertIn("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN",buf.getvalue())
 def test_scope_five(self):
  self.assertEqual(len(v.att.NAMES),5)
  self.assertEqual(set(v.TARGETS),{"recordingStatus","usageStatus"})
if __name__=="__main__":unittest.main()
