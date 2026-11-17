#!/usr/bin/env python3
"""V7 Hosting read-only parity tests (no external requests)."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch
from io import BytesIO
from urllib.request import Request

p=pathlib.Path(__file__).with_name("rr-v7-staging-hosting-parity-readonly.py")
spec=importlib.util.spec_from_file_location("v7parity",p)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class FakeResp:
    status=200
    def __init__(self,data):self.data=data
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,n):return self.data[:n]
class FakeOpener:
    def __init__(self,data):self.data=data;self.calls=0
    def open(self,request,timeout):
        self.calls+=1
        assert isinstance(request,Request)
        assert request.get_method()=="GET"
        return FakeResp(self.data)
class TestV7(unittest.TestCase):
    def test_canonical_index_uses_root_not_html_redirect(self):
        self.assertEqual(mod.asset_url("https://packtook-staging.web.app","index.html"),
                         "https://packtook-staging.web.app/")
    def test_js_asset_path_unchanged(self):
        self.assertEqual(mod.asset_url("https://packtook-staging.web.app","app.js"),
                         "https://packtook-staging.web.app/app.js")
    def test_match(self):self.assertEqual(mod.classify(b"a",b"a"),"MATCH")
    def test_drift(self):self.assertEqual(mod.classify(b"a",b"b"),"DRIFT")
    def test_bounded_get(self):
        opener=FakeOpener(b"window.mock=true;")
        self.assertEqual(mod.fetch("https://packtook-staging.web.app/app.js",opener),b"window.mock=true;")
        self.assertEqual(opener.calls,1)
    def test_empty_asset_rejected(self):
        with self.assertRaises(ValueError):
            mod.fetch("https://packtook-staging.web.app/app.js",FakeOpener(b""))
    def test_large_asset_rejected(self):
        with self.assertRaises(ValueError):
            mod.fetch("https://packtook-staging.web.app/app.js",FakeOpener(b"x"*(mod.MAX_BYTES+1)))
    def test_redirect_policy_blocks(self):
        with self.assertRaises(ValueError):
            mod.DenyRedirect().redirect_request(None,None,302,"Moved",{},"https://somewhere-else")
    def test_host_allowlist_is_staging_only(self):
        self.assertNotIn("packtook-prod-01.web.app",mod.ALLOWED_HOSTS)
        self.assertIn("packtook-staging.web.app",mod.ALLOWED_HOSTS)
    def test_required_assets(self):
        self.assertEqual(len(mod.ASSETS),5)
        self.assertIn("video-stream-writer.js",mod.ASSETS)
        self.assertIn("firebase-packing-bridge.js",mod.ASSETS)
if __name__=="__main__":unittest.main()
