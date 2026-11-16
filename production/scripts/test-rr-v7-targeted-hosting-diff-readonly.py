#!/usr/bin/env python3
"""V7 targeted read-only diff test, mock bytes only."""
import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).with_name("rr-v7-targeted-hosting-diff-readonly.py")
spec=importlib.util.spec_from_file_location("target",p)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class Tests(unittest.TestCase):
 def test_query_versions(self):
  a=b'<script src="app.js?v=5.6"></script>'
  b=b'<script src="app.js?v=5.7"></script>'
  state,pairs=mod.script_summary(a,b)
  self.assertEqual(state,"SCRIPT_VERSION_QUERIES_DIFFER")
  self.assertEqual(len(pairs),1)
 def test_script_order(self):
  a=b'<script src="a.js"></script><script src="b.js"></script>'
  b=b'<script src="b.js"></script><script src="a.js"></script>'
  self.assertEqual(mod.script_summary(a,b)[0],"SCRIPT_ORDER_DIFFER")
 def test_script_path_changed(self):
  a=b'<script src="app.js"></script>'
  b=b'<script src="newapp.js"></script>'
  self.assertEqual(mod.script_summary(a,b)[0],"SCRIPT_FILE_PATHS_DIFFER")
 def test_app_check_bridge_category(self):
  a=b'window.PACKTOOK_FIREBASE={};\n'
  b=a+b'initializeAppCheck(app, config);\n'
  cats,old,new=mod.bridge_summary(a,b)
  self.assertGreater(cats["APP_CHECK"][1],0)
  self.assertGreater(new,old)
 def test_no_raw_source_emitted(self):
  cats,old,new=mod.bridge_summary(b'a',b'SECRET_DO_NOT_PRINT')
  self.assertEqual((old,new),(1,1))
  self.assertNotIn("SECRET",str(cats))
if __name__=="__main__":unittest.main()
