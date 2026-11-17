#!/usr/bin/env python3
"""Offline synthetic, no cloud access."""
import importlib.util,io,pathlib,unittest,zipfile
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-handler-semantic-attestation-readonly.py")
spec=importlib.util.spec_from_file_location("semv7",p)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
def code(name="reserveCredit",body='uid(req);ownerRef(id);db.runTransaction(()=>{});validOp(op);validDevice(id);barcodeLocks;reserved;',option="enforceAppCheck:true"):
 return ('const options={'+option+'};\nexports.'+name+'=onCall(options,async req=>{\n'+body+'\n});\n').encode()
def zip_bytes(data):
 buffer=io.BytesIO()
 with zipfile.ZipFile(buffer,"w") as z:z.writestr("index.js",data)
 return buffer.getvalue()
def source():
 return {"state":"ACTIVE","buildConfig":{"source":{"storageSource":{
 "bucket":"gcf-v2-sources-123-asia-southeast1","object":"src.zip","generation":"100"}}}}
class Tests(unittest.TestCase):
 def test_extract(self):
  self.assertIn("exports.reserveCredit",v.handler(code(),"reserveCredit"))
 def test_missing_handler_blocks(self):
  with self.assertRaisesRegex(ValueError,"EXPORT_UNVERIFIABLE"):v.handler(code(),"finalizeCredit")
 def test_ambiguous_handler_blocks(self):
  with self.assertRaisesRegex(ValueError,"EXPORT_UNVERIFIABLE"):
   v.handler(code()+code(),"reserveCredit")
 def test_ambiguous_terminator_blocks(self):
  with self.assertRaisesRegex(ValueError,"UNVERIFIABLE"):
   v.handler(b'exports.reserveCredit=onCall(options, async req=>{',"reserveCredit")
 def test_options_true(self):
  self.assertEqual(v.export_options(code(),"reserveCredit"),"ENFORCEMENT_TRUE_LITERAL_IN_OPTIONS")
 def test_options_false(self):
  self.assertEqual(v.export_options(code(option="enforceAppCheck:false"),"reserveCredit"),"ENFORCEMENT_FALSE_LITERAL_IN_OPTIONS")
 def test_missing_enforcement(self):
  self.assertEqual(v.export_options(code(option="region"),"reserveCredit"),"NO_ENFORCEMENT_LITERAL_IN_OPTIONS")
 def test_options_inline(self):
  s=b'exports.reserveCredit=onCall({enforceAppCheck:true},async req=>{\nuid(req);\n});'
  self.assertEqual(v.export_options(s,"reserveCredit"),"ENFORCEMENT_TRUE_LITERAL_IN_OPTIONS")
 def test_changed_body(self):
  a=code();b=code(body="uid(req);")
  r=v.compare(a,b,"reserveCredit")
  self.assertEqual(r["body"],"DIFFERENT")
  self.assertIn("TRANSACTION",r["removed"])
 def test_exact_body(self):
  r=v.compare(code(),code(),"reserveCredit")
  self.assertEqual(r["body"],"EXACT_MATCH")
 def test_unrelated_helpers_not_claimed_equivalent(self):
  a=code()+b'function creditAvailable(){return 1;}\n'
  b=code()+b'function creditAvailable(){return 2;}\n'
  self.assertEqual(v.compare(a,b,"reserveCredit")["body"],"EXACT_MATCH")
  # Handler match explicitly does NOT establish helper/runtime equivalence.
 def test_never_print_source(self):
  a=code()+b'// SECRET_NEVER_PRINT\n'
  metas={name:source() for name in v.NAMES}
  buf=io.StringIO()
  with redirect_stdout(buf):
   v.examine(metas,a,lambda src:zip_bytes(a))
  self.assertNotIn("SECRET_NEVER_PRINT",buf.getvalue())
  self.assertNotIn("gcf-v2-sources",buf.getvalue())
  self.assertIn("EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN",buf.getvalue())
 def test_malformed_source_fail_closed(self):
  buf=io.StringIO()
  metas={name:None for name in v.NAMES}
  with redirect_stdout(buf):v.examine(metas,code(),lambda _:b"")
  self.assertIn("REVIEW_REQUIRED",buf.getvalue())
 def test_expected_scope(self):
  self.assertEqual(len(v.NAMES),5)
  self.assertEqual(len(v.CRITICAL),5)
if __name__=="__main__":unittest.main()
