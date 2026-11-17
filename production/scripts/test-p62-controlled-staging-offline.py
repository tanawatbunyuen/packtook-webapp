#!/usr/bin/env python3
"""Synthetic P62 operator tests: no actual git/gcloud invocation."""
import importlib.util
import pathlib
import unittest
from unittest.mock import Mock,patch

path=pathlib.Path(__file__).with_name("p62-controlled-staging-readonly.py")
spec=importlib.util.spec_from_file_location("p62_probe",path)
p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
BASE={"P62_ALLOW_STAGING_READ":"YES","RR_STAGING_PROJECT_ID":"packtook-staging"}
def good_log():
    rows=[]
    for name in p.NAMES:
        rows.extend(("FUNCTION: "+name,
                     "DEPLOYED_HANDLER_EQUALS_REVIEW_BRANCH: MATCH",
                     "SOURCE_ARCHIVE_READ: PINNED_GENERATION_RAM_ONLY"))
    rows.extend(("SOURCE_ATTESTATION_SUMMARY: MATCH_ALL",
                 "EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN",
                 "STAGING_SOURCE_REVISION_STABLE: YES",
                 "P61_STAGING_SOURCE_GATE: MATCH_STABLE_INSPECTION_ONLY",
                 "RELEASE: NO_GO_RELEASE"))
    return "\n".join(rows)+"\n"
def runner(stdout=good_log(),rc=0,branch=p.BRANCH):
    calls=[]
    def call(args,**kwargs):
        calls.append(args)
        if args[0]=="git":return Mock(returncode=0,stdout=branch+"\n")
        return Mock(returncode=rc,stdout=stdout)
    return call,calls
class P62(unittest.TestCase):
    def test_missing_execute_never_calls_cloud(self):
        f,calls=runner()
        self.assertEqual(p.run([],BASE,f),2)
        self.assertFalse(calls)
    def test_missing_optin_blocks(self):
        f,calls=runner()
        self.assertEqual(p.run(["--execute"],{"RR_STAGING_PROJECT_ID":"packtook-staging"},f),2)
        self.assertFalse(calls)
    def test_production_project_blocks(self):
        f,calls=runner()
        self.assertEqual(p.run(["--execute"],{"P62_ALLOW_STAGING_READ":"YES","RR_STAGING_PROJECT_ID":"packtook-prod-01"},f),2)
        self.assertFalse(calls)
    def test_secret_environment_blocks(self):
        f,calls=runner()
        self.assertEqual(p.run(["--execute"],{**BASE,"FIREBASE_TOKEN":"hidden"},f),2)
        self.assertFalse(calls)
    def test_five_match_and_stable_summary(self):
        self.assertTrue(p.summary(good_log()))
    def test_missing_function_blocks(self):
        self.assertFalse(p.summary(good_log().replace("FUNCTION: usageStatus","FUNCTION: other")))
    def test_drift_blocks(self):
        self.assertFalse(p.summary(good_log().replace("BRANCH: MATCH","BRANCH: DRIFT",1)))
    def test_revision_rollover_blocks(self):
        self.assertFalse(p.summary(good_log().replace("STAGING_SOURCE_REVISION_STABLE: YES","STAGING_SOURCE_REVISION_STABLE: NOT_VERIFIABLE")))
    def test_deployed_check_does_not_prove_appcheck(self):
        self.assertFalse(p.summary(good_log().replace("EFFECTIVE_APP_CHECK_ENFORCEMENT: NOT_PROVEN","EFFECTIVE_APP_CHECK_ENFORCEMENT: PROVEN")))
    def test_successful_synthetic_guarded_execution(self):
        f,calls=runner()
        with patch.object(p.ATTEST.__class__,"is_file",return_value=True),patch.object(p.shutil,"which",return_value="/usr/bin/gcloud"):
            self.assertEqual(p.run(["--execute"],BASE,f),0)
        self.assertEqual(len(calls),2)
    def test_wrong_branch_blocks_before_probe(self):
        f,calls=runner(branch="main")
        with patch.object(p.ATTEST.__class__,"is_file",return_value=True),patch.object(p.shutil,"which",return_value="/usr/bin/gcloud"):
            self.assertEqual(p.run(["--execute"],BASE,f),2)
        self.assertEqual(len(calls),1)
    def test_child_nonzero_blocks(self):
        f,calls=runner(rc=2)
        with patch.object(p.ATTEST.__class__,"is_file",return_value=True),patch.object(p.shutil,"which",return_value="/usr/bin/gcloud"):
            self.assertEqual(p.run(["--execute"],BASE,f),2)
        self.assertEqual(len(calls),2)
if __name__=="__main__":unittest.main()
