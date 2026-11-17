#!/usr/bin/env python3
"""P63 source integrity/stability regression; synthetic, no Cloud calls."""
import importlib.util
import io
import pathlib
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import Mock,patch

P=pathlib.Path(__file__).with_name("p63-staging-security-readonly.py")
spec=importlib.util.spec_from_file_location("p63_gate",P)
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

def metadata():
    return {"state":"ACTIVE","updateTime":"2026-11-17T14:00:00Z",
      "buildConfig":{"source":{"storageSource":{
      "bucket":"gcf-v2-sources-123456789-asia-southeast1",
      "object":"source.zip","generation":"1700000000000000"}}}}

def good_report():
    return {"state":"STATIC_SCOPED_GUARD_MATCH_REVIEW_ONLY",
      "recordingStatus":{"reviewGuarded":True,"deployedGuarded":True,
         "calleeMatch":True,"optionsIdentifierMatch":True},
      "usageStatus":{"reviewGuarded":True,"deployedGuarded":True,
         "calleeMatch":True,"optionsIdentifierMatch":True},
      "scopedDependencies":"EXACT_SCOPED_TOKENS_REVIEW_REQUIRED",
      "backendAppCheck":"NOT_PROVEN","runtimeEquivalence":"NOT_PROVEN",
      "release":"NO_GO_RELEASE"}

class P63Integrity(unittest.TestCase):
    def test_git_bytes_match_accepted(self):
        content=(p.ROOT/"production/functions/index.js").read_bytes()
        def runner(cmd,**kwargs):
            if cmd[1]=="branch":return Mock(returncode=0,stdout=p.BRANCH+"\n")
            self.assertFalse(kwargs.get("text",True),"git show must return bytes")
            return Mock(returncode=0,stdout=content)
        self.assertEqual(p.checked_local(runner),content)

    def test_git_bytes_modified_rejected(self):
        def runner(cmd,**kwargs):
            if cmd[1]=="branch":return Mock(returncode=0,stdout=p.BRANCH+"\n")
            return Mock(returncode=0,stdout=b"modified")
        with self.assertRaisesRegex(ValueError,"LOCAL_SOURCE_DIRTY"):
            p.checked_local(runner)

    def test_wrong_branch_rejected_before_show(self):
        calls=[]
        def runner(cmd,**kwargs):
            calls.append(cmd)
            return Mock(returncode=0,stdout="main\n")
        with self.assertRaisesRegex(ValueError,"WRONG_BRANCH"):
            p.checked_local(runner)
        self.assertEqual(len(calls),1)

    def test_parse_report_rejects_fake_appcheck_proof(self):
        import json
        data=good_report();data["backendAppCheck"]="PROVEN"
        with self.assertRaises(ValueError):p.parse_report(json.dumps(data))

    def test_five_revision_metadata_required_even_for_two_callables(self):
        seen=[]
        def get_metadata(name):
            seen.append(name)
            return metadata()
        output=io.StringIO()
        with patch.object(sys,"argv",["p63","--inspect-source"]),\
             patch.dict("os.environ",{"P63_ALLOW_STAGING_READ":"YES"},clear=False),\
             patch.object(p.att,"guard"),\
             patch.object(p,"checked_local",return_value=b"fake local"),\
             patch.object(p.att,"function_metadata",side_effect=get_metadata),\
             patch.object(p.att,"bounded_archive",return_value=b"ZIP"),\
             patch.object(p.att,"handler_from_zip",return_value=b"fake deployed"),\
             patch.object(p,"inspect",return_value=good_report()):
            with redirect_stdout(output):rc=p.main()
        self.assertEqual(rc,0)
        self.assertEqual(seen,list(p.att.NAMES)*2)
        self.assertIn("P63_SOURCE_STABLE: YES",output.getvalue())
        self.assertIn("P63_BACKEND_APP_CHECK: NOT_PROVEN",output.getvalue())
        self.assertIn("RELEASE: NO_GO_RELEASE",output.getvalue())

    def test_revision_change_blocks(self):
        seen=[]
        def get_metadata(name):
            seen.append(name)
            x=metadata()
            if len(seen)>len(p.att.NAMES) and name=="usageStatus":
                x["updateTime"]="2026-11-17T14:01:00Z"
            return x
        output=io.StringIO()
        with patch.object(sys,"argv",["p63","--inspect-source"]),\
             patch.dict("os.environ",{"P63_ALLOW_STAGING_READ":"YES"},clear=False),\
             patch.object(p.att,"guard"),\
             patch.object(p,"checked_local",return_value=b"fake local"),\
             patch.object(p.att,"function_metadata",side_effect=get_metadata),\
             patch.object(p.att,"bounded_archive",return_value=b"ZIP"),\
             patch.object(p.att,"handler_from_zip",return_value=b"fake deployed"),\
             patch.object(p,"inspect",return_value=good_report()):
            with redirect_stdout(output):rc=p.main()
        self.assertEqual(rc,2)
        self.assertIn("P63_SOURCE_STABLE: NOT_VERIFIABLE",output.getvalue())

if __name__=="__main__":unittest.main()
