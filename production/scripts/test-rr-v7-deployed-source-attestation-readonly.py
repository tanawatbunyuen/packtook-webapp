#!/usr/bin/env python3
"""Offline only: synthetic ZIPs and mocked metadata. No cloud requests."""
import importlib.util
import io
import pathlib
import unittest
import zipfile
from unittest.mock import patch
p=pathlib.Path(__file__).with_name("rr-v7-deployed-source-attestation-readonly.py")
spec=importlib.util.spec_from_file_location("attest",p)
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
def zipped(files):
    mem=io.BytesIO()
    with zipfile.ZipFile(mem,"w") as z:
        for name,content in files.items():z.writestr(name,content)
    return mem.getvalue()
def info(gen="1700000000000000",bucket="gcf-v2-sources-123456789-asia-southeast1",obj="function-source.zip"):
    return {"state":"ACTIVE","buildConfig":{"source":{"storageSource":{"bucket":bucket,"object":obj,"generation":gen}}}}
class Tests(unittest.TestCase):
    def test_pinned_identity(self):
        self.assertEqual(len(v.pinned_source(info())),3)
    def test_missing_generation_blocks(self):
        self.assertIsNone(v.pinned_source(info(gen="")))
    def test_unexpected_bucket_blocks(self):
        self.assertIsNone(v.pinned_source(info(bucket="prod-secrets")))
    def test_bad_object_blocks(self):
        self.assertIsNone(v.pinned_source(info(obj="../functions.zip")))
    def test_must_be_active(self):
        x=info();x["state"]="DEPLOYING"
        self.assertIsNone(v.pinned_source(x))
    def test_handler_zip_root(self):
        self.assertEqual(v.handler_from_zip(zipped({"index.js":b"safe"})),b"safe")
    def test_handler_zip_nested(self):
        self.assertEqual(v.handler_from_zip(zipped({"functions/index.js":b"safe"})),b"safe")
    def test_ambiguous_archive_blocks(self):
        with self.assertRaisesRegex(ValueError,"AMBIGUOUS"):
            v.handler_from_zip(zipped({"index.js":b"a","functions/index.js":b"b"}))
    def test_missing_handler_blocks(self):
        with self.assertRaisesRegex(ValueError,"AMBIGUOUS"):
            v.handler_from_zip(zipped({"notes.txt":b"private"}))
    def test_oversize_js_blocks(self):
        with self.assertRaisesRegex(ValueError,"SIZE"):
            v.handler_from_zip(zipped({"index.js":b"a"*(v.MAX_JS+1)}))
    def test_bad_archive_blocks(self):
        with self.assertRaisesRegex(ValueError,"ARCHIVE"):
            v.handler_from_zip(b"not ZIP")
    def test_literal_true(self):
        self.assertEqual(v.static_app_check_status(b"const options={enforceAppCheck:true};"),"TRUE_LITERAL_PRESENT_NOT_HANDLER_PROOF")
    def test_literal_false(self):
        self.assertEqual(v.static_app_check_status(b"const options={enforceAppCheck:false};"),"FALSE_LITERAL_PRESENT")
    def test_comment_not_counted(self):
        self.assertEqual(v.static_app_check_status(b"// enforceAppCheck:true\nconst options={region};"),"NO_LITERAL_DECLARATION")
    def test_conflicting_literals(self):
        self.assertEqual(v.static_app_check_status(b"const a={enforceAppCheck:true};const b={enforceAppCheck:false};"),"CONFLICTING_STATIC_DECLARATIONS")
    def test_no_cloud_when_project_mismatch(self):
        with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-prod-01"},clear=True):
            with self.assertRaises(ValueError):
                v.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("called")))
    def test_no_cloud_when_secret_env(self):
        with patch.dict("os.environ",{"RR_STAGING_PROJECT_ID":"packtook-staging","FIREBASE_TOKEN":"secret"},clear=True):
            with self.assertRaises(ValueError):
                v.guard(lambda *a,**k: (_ for _ in ()).throw(AssertionError("called")))
    def test_attest_no_source_output(self):
        from contextlib import redirect_stdout
        buf=io.StringIO()
        secret=b"SECRET_TEST_VALUE"
        code=b"const options={enforceAppCheck:true};\n"+secret
        with redirect_stdout(buf):
            v.attest({name:info() for name in v.NAMES},code,lambda src:zipped({"index.js":code}))
        self.assertNotIn("SECRET_TEST_VALUE",buf.getvalue())
        self.assertNotIn("gcf-v2-sources",buf.getvalue())
        self.assertIn("MATCH_ALL",buf.getvalue())
        self.assertIn("EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN",buf.getvalue())
    def test_attest_one_missing_fail_closed(self):
        from contextlib import redirect_stdout
        buf=io.StringIO()
        infos={name:info() for name in v.NAMES}
        infos["reserveCredit"]=None
        with redirect_stdout(buf):
            v.attest(infos,b"local",lambda src:zipped({"index.js":b"local"}))
        self.assertIn("REVIEW_REQUIRED",buf.getvalue())
    def test_five_named_functions(self):
        self.assertEqual(len(v.NAMES),5)
        self.assertNotIn("createOmisePayment",v.NAMES)
if __name__=="__main__":unittest.main()
