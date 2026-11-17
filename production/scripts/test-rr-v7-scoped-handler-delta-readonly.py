#!/usr/bin/env python3
"""Offline synthetic tests; no source archive or cloud access."""
import importlib.util,pathlib,unittest
p=pathlib.Path(__file__).with_name("rr-v7-scoped-handler-delta-readonly.py")
spec=importlib.util.spec_from_file_location("delta",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def source(modify=None,shared="return 1"):
 names=m.NAMES
 sections=['const options={region:"asia-southeast1"};','function shared(){'+shared+';}']
 for name in names:
  value='const id=uid(req);\n const x=await ownerRef(id);\n return {recordingId:1};'
  if modify and name==modify[0]:value=modify[1]
  sections.append('exports.'+name+'=onCall(options,async req=>{\n'+value+'\n});')
 return ('\n'.join(sections)+'\n').encode()
class Checks(unittest.TestCase):
 def test_all_handlers_match(self):
  a=source()
  for name in m.NAMES:
   r=m.analyze(a,a,name)
   self.assertEqual(r["handler"],"MATCH")
   self.assertEqual(r["shared_module"],"MATCH")
 def test_shared_helper_drift(self):
  a=source();b=source(shared="return 2")
  r=m.analyze(a,b,"reserveCredit")
  self.assertEqual(r["handler"],"MATCH")
  self.assertEqual(r["shared_module"],"DRIFT")
  self.assertGreater(r["shared_changed_blocks"],0)
 def test_scoped_recording_status(self):
  a=source();b=source(("recordingStatus",'const id=uid(req);\n return {recordingId:2};'))
  r=m.analyze(a,b,"recordingStatus")
  self.assertEqual(r["handler"],"DRIFT")
  self.assertIn("AUTH_TENANCY",r["categories"])
  self.assertIn("DATA_CONTRACT",r["categories"])
 def test_usage_status_changed(self):
  a=source();b=source(("usageStatus","return {remaining:0};"))
  r=m.analyze(a,b,"usageStatus")
  self.assertEqual(r["handler"],"DRIFT")
  self.assertIn("DATA_CONTRACT",r["categories"])
 def test_broken_export_fails_closed(self):
  with self.assertRaises(ValueError):m.analyze(b'bad',source(),"reserveCredit")
 def test_no_full_source_in_report_categories(self):
  a=source(shared="const MY_SECRET_VALUE = 42")
  b=source(shared="const MY_SECRET_VALUE = 43")
  r=m.analyze(a,b,"reserveCredit")
  self.assertNotIn("MY_SECRET_VALUE",str(r))
 def test_diff_no_change(self):
  self.assertEqual(m.changed("a","a"),[])
 def test_diff_change(self):
  self.assertEqual(len(m.changed("a","b")),1)
 def test_scope(self):
  self.assertEqual(len(m.NAMES),5)
if __name__=="__main__":unittest.main()
