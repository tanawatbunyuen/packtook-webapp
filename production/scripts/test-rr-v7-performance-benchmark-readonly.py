#!/usr/bin/env python3
"""Offline-only performance benchmark invariants; no Staging calls."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch
p=pathlib.Path(__file__).with_name("rr-v7-performance-benchmark-readonly.py")
spec=importlib.util.spec_from_file_location("perfbench",p)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
class Tests(unittest.TestCase):
 def test_speedup_math(self):
  base,fast,pct=v.summarize([{"legacy":300,"onepass":100},{"legacy":250,"onepass":150},{"legacy":200,"onepass":50}])
  self.assertEqual(base,250)
  self.assertEqual(fast,100)
  self.assertEqual(pct,60)
 def test_no_zero_division(self):
  self.assertIsNone(v.summarize([{"legacy":0,"onepass":0}])[2])
 def test_expected_io_counts(self):
  pins={n:(1,2,3) for n in v.att.NAMES}
  count=[]
  def fake_loader(pin):
   count.append(pin);return b"zip"
  with patch.object(v.att,"handler_from_zip",return_value=b"code"),\
       patch.object(v.impact,"helper_status",return_value="EXACT"),\
       patch.object(v.scope,"operations",return_value=[]),\
       patch.object(v.sem,"handler",return_value="return"),\
       patch.object(v.target,"selected_changes",return_value=("EXACT_EXPRESSIONS",(),0)),\
       patch.object(v.one,"checked",return_value={"ops":{}}):
   self.assertEqual(v.legacy(b"code",pins,fake_loader),15)
   self.assertEqual(v.optimized(b"code",pins,fake_loader),5)
  self.assertEqual(len(count),20)
 def test_missing_pins_fail_closed(self):
  with self.assertRaises(ValueError):v.legacy(b"code",{},lambda _:b"")
 def test_scope_is_fixed(self):
  self.assertEqual(len(v.att.NAMES),5)
if __name__=="__main__":unittest.main()
