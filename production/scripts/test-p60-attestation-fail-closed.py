#!/usr/bin/env python3
"""P60 offline fail-closed regression tests, no cloud/network calls."""
import importlib.util
import io
import pathlib
import sys
import unittest
import zipfile
from contextlib import redirect_stdout
from unittest.mock import patch

SOURCE=pathlib.Path(__file__).with_name("rr-v7-deployed-source-attestation-readonly.py")
spec=importlib.util.spec_from_file_location("p60_attestation",SOURCE)
att=importlib.util.module_from_spec(spec)
spec.loader.exec_module(att)

def pinned():
    return {"state":"ACTIVE","buildConfig":{"source":{"storageSource":{
        "bucket":"gcf-v2-sources-12345-asia-southeast1",
        "object":"source.zip","generation":"1700000000000000"}}}}

def archive(value):
    out=io.BytesIO()
    with zipfile.ZipFile(out,"w") as z:
        z.writestr("index.js",value)
    return out.getvalue()

def evaluate(metadata,local=b"const a=1;",loader=None):
    buf=io.StringIO()
    if loader is None:loader=lambda _:archive(local)
    with redirect_stdout(buf):
        ok=att.attest(metadata,local,loader)
    return ok,buf.getvalue()

class P60FailClosed(unittest.TestCase):
    def test_all_five_matching(self):
        passed,log=evaluate({n:pinned() for n in att.NAMES})
        self.assertTrue(passed)
        self.assertIn("SOURCE_ATTESTATION_SUMMARY: MATCH_ALL",log)
        self.assertIn("EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN",log)

    def test_one_drift_nonzero_signal(self):
        metadata={n:pinned() for n in att.NAMES}
        calls=iter(range(len(att.NAMES)))
        def loader(_):
            return archive(b"drift" if next(calls)==2 else b"const a=1;")
        passed,log=evaluate(metadata,loader=loader)
        self.assertFalse(passed)
        self.assertIn("DEPLOYED_HANDLER_EQUALS_REVIEW_BRANCH: DRIFT",log)
        self.assertIn("SOURCE_ATTESTATION_SUMMARY: REVIEW_REQUIRED",log)

    def test_one_unpinned_nonzero_signal(self):
        metadata={n:pinned() for n in att.NAMES}
        metadata["usageStatus"]=None
        passed,log=evaluate(metadata)
        self.assertFalse(passed)
        self.assertIn("BLOCKED_UNPINNED_OR_UNVERIFIED_SOURCE",log)

    def test_archive_failure_nonzero_signal(self):
        metadata={n:pinned() for n in att.NAMES}
        passed,log=evaluate(metadata,loader=lambda _:b"invalid zip")
        self.assertFalse(passed)
        self.assertIn("BLOCKED_ARCHIVE_READ_OR_PARSE",log)

    def test_missing_optin_never_calls_guard_or_reads_cloud(self):
        with patch.object(sys,"argv",["attest"]),patch.object(att,"guard",
                side_effect=AssertionError("should not reach cloud")):
            buf=io.StringIO()
            with redirect_stdout(buf):code=att.run()
        self.assertEqual(code,2)
        self.assertIn("BLOCKED_EXPLICIT_INSPECTION_FLAG_REQUIRED",buf.getvalue())

    def test_mismatch_returns_nonzero_from_main(self):
        with patch.object(sys,"argv",["attest","--inspect-source"]),\
             patch.object(att,"guard"),\
             patch.object(att,"function_metadata",return_value=pinned()),\
             patch.object(att,"bounded_archive",return_value=archive(b"other")):
            buf=io.StringIO()
            with redirect_stdout(buf):code=att.run()
        self.assertEqual(code,2)
        self.assertIn("SOURCE_ATTESTATION_SUMMARY: REVIEW_REQUIRED",buf.getvalue())
        self.assertIn("RELEASE: NO_GO_RELEASE",buf.getvalue())

    def test_no_raw_source_or_bucket_in_stdout(self):
        secret=b"SENSITIVE_SYNTHETIC_FIXTURE"
        metadata={n:pinned() for n in att.NAMES}
        passed,log=evaluate(metadata,secret)
        self.assertTrue(passed)
        self.assertNotIn(secret.decode(),log)
        self.assertNotIn("gcf-v2-sources-",log)

if __name__=="__main__":unittest.main()
