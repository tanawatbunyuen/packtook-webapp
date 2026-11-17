#!/usr/bin/env python3
"""Offline tests: no remote source, Firestore or Cloud Functions call."""
import importlib.util
import io
import pathlib
import unittest
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-final-contract-review-readonly.py")
spec=importlib.util.spec_from_file_location("finalreview",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def sources(status="ok",extra=""):
 a="const options={region:'asia-southeast1'};\n"
 for n in m.att.NAMES:
  if n=="recordingStatus":
   body="return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file};"
  elif n=="usageStatus":
   body="return {"+",".join(k+":"+("1" if k=="plan" else "null") for k in m.EXPECTED[n])+"};"
  else:body="return {status:'ok'};"
  if n=="recordingStatus" and status!="ok":body=body.replace("file:r.file","file:"+status)
  a+="exports."+n+"=onCall(options,async req=>{\n"+body+"\n});\n"
 return (a+extra).encode()
class Tests(unittest.TestCase):
 def test_equal_handlers(self):
  a=sources()
  r=m.review(a,a,"recordingStatus")
  self.assertTrue(r["handler_match"])
  self.assertEqual(r["signals_changed"],())
 def test_changed_return_value_without_missing_field(self):
  r=m.review(sources(),sources(status="null"),"recordingStatus")
  self.assertFalse(r["handler_match"])
  self.assertEqual(r["signals_changed"],())
  self.assertIn("RESPONSE_CONTRACT",r["categories"])
 def test_missing_field_signal(self):
  a=sources()
  b=a.replace(b"file:r.file",b"fileRemoved:r.file")
  r=m.review(a,b,"recordingStatus")
  self.assertIn("file",r["signals_changed"])
  self.assertIn("file",r["missing_deployed"])
 def test_changed_shared_module(self):
  r=m.review(sources(extra="const x=1;"),sources(extra="const x=2;"),"usageStatus")
  self.assertFalse(r["shared_match"])
 def test_no_raw_literals_in_emit(self):
  a=sources(status="'PRIVATE_SECRET_VALUE'")
  r=m.review(sources(),a,"recordingStatus")
  buf=io.StringIO()
  with redirect_stdout(buf):m.emit("recordingStatus",r)
  self.assertNotIn("PRIVATE_SECRET_VALUE",buf.getvalue())
  self.assertNotIn("SECRET",buf.getvalue())
 def test_shorthand_response_fields(self):
  body="return {plan:a.plan,limit,used,reserved,remaining:creditAvailable(a)};"
  keys=m.field_signals(body,"usageStatus")
  self.assertTrue(keys["limit"])
  self.assertTrue(keys["used"])
  self.assertTrue(keys["reserved"])
  self.assertTrue(keys["plan"])
 def test_short_identifier_not_false_positive(self):
  keys=m.field_signals("return {limitValue:1,usedUp:2};","usageStatus")
  self.assertFalse(keys["limit"])
  self.assertFalse(keys["used"])
 def test_all_expected_usage_keys_signal(self):
  body="return {"+",".join(k+":"+"null" if k not in ("limit","used","reserved") else k for k in m.EXPECTED["usageStatus"])+"};"
  keys=m.field_signals(body,"usageStatus")
  self.assertTrue(all(keys.values()))
 def test_missing_key_counts(self):
  a=sources()
  r=m.review(a,a,"usageStatus")
  self.assertEqual(len(r["missing_deployed"]),0)
  self.assertEqual(len(r["missing_local"]),0)
 def test_high_risk_error_category(self):
  blocks=[(["throw new HttpsError('not-found','x')"],["throw new HttpsError('permission-denied','x')"])]
  self.assertIn("ERROR_CONTRACT",m.changed_category(blocks))
 def test_no_appcheck_proof(self):
  buf=io.StringIO()
  with redirect_stdout(buf):m.emit("usageStatus",m.review(sources(),sources(),"usageStatus"))
  self.assertIn("SEMANTIC_EQUIVALENCE: NOT_PROVEN",buf.getvalue())
 def test_scope(self):
  self.assertEqual(len(m.att.NAMES),5)
  self.assertEqual(set(m.EXPECTED),{"recordingStatus","usageStatus"})
if __name__=="__main__":unittest.main()
