#!/usr/bin/env python3
"""Offline manifest integrity checks for unified V7 runner."""
import importlib.util
import pathlib
import unittest
root=pathlib.Path(__file__).resolve().parent
file=root/"rr-v7-unified-offline-ci.py"
spec=importlib.util.spec_from_file_location("unified",file)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 def test_declared_manifest_exists(self):
  self.assertEqual(len(m.SCRIPTS),21)
  self.assertEqual(len(set(m.SCRIPTS)),len(m.SCRIPTS))
  for name in m.SCRIPTS:
   self.assertTrue((root/("rr-v7-"+name+"-readonly.py")).is_file())
   self.assertTrue((root/("test-rr-v7-"+name+"-readonly.py")).is_file())
 def test_loader_includes_tests(self):
  suite=m.suite_and_compiled(names=("one-pass",))
  self.assertGreaterEqual(suite.countTestCases(),6)
 def test_missing_manifest_fails_closed(self):
  with self.assertRaises(ValueError):
   m.suite_and_compiled(names=("non-existent",))
 def test_no_live_run_from_manifest(self):
  self.assertTrue(all(name!="device-integration" for name in m.SCRIPTS))
if __name__=="__main__":unittest.main()
