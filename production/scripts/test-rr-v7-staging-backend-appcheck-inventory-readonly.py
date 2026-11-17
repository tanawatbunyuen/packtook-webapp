#!/usr/bin/env python3
"""Offline unit checks for V7 read-only deployed App Check function inventory."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch
import subprocess
p=pathlib.Path(__file__).with_name("rr-v7-staging-backend-appcheck-inventory-readonly.py")
spec=importlib.util.spec_from_file_location("v7backend",p)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class FakeResult:
    def __init__(self,returncode=0,stdout='{}'):
        self.returncode=returncode
        self.stdout=stdout
        self.stderr="PRIVATE INFORMATION SHOULD NEVER BE DISPLAYED"
class Checks(unittest.TestCase):
    def test_source_options_without_app_check(self):
        text='const options={region,maxInstances:20}; // enforceAppCheck:true someday'
        self.assertEqual(mod.source_policy(text),"NO_GLOBAL_ENFORCEMENT_DECLARATION")
    def test_source_options_enforced(self):
        self.assertEqual(mod.source_policy('const options={region,enforceAppCheck:true};'),
                         "ENFORCEMENT_DECLARED_IN_SOURCE")
    def test_source_options_explicit_disabled(self):
        self.assertEqual(mod.source_policy('const options={enforceAppCheck:false};'),
                         "ENFORCEMENT_DISABLED_IN_SOURCE")
    def test_active(self):
        self.assertEqual(mod.classify({'state':'ACTIVE'}),"ACTIVE")
    def test_failure_not_active(self):
        self.assertEqual(mod.classify({'state':'FAILED'}),"NOT_ACTIVE")
    def test_no_env_output(self):
        def runner(args,**kwargs):
            self.assertIn('--project=packtook-staging',args)
            self.assertIn('--gen2',args)
            self.assertEqual(args[-1],'--format=json')
            self.assertNotIn('update',args)
            return FakeResult(stdout='{"state":"ACTIVE","serviceConfig":{"secretEnvironmentVariables":["PRIVATE"]}}')
        status,meta=mod.describe('reserveCredit',runner)
        self.assertEqual(status,'FOUND')
        self.assertEqual(mod.classify(meta),'ACTIVE')
    def test_failed_gcloud_does_not_leak_stderr(self):
        status,info=mod.describe('usageStatus',lambda *args,**kwargs:FakeResult(returncode=1))
        self.assertEqual(status,'DESCRIBE_FAILED')
        self.assertIsNone(info)
    def test_refuses_prod_env_before_project_lookup(self):
        with patch.dict('os.environ',{'RR_STAGING_PROJECT_ID':'packtook-prod-01'},clear=True):
            with patch.object(mod.subprocess,'run',side_effect=AssertionError('should not call')):
                with self.assertRaises(ValueError):mod.guard()
    def test_refuses_credentials(self):
        with patch.dict('os.environ',{'RR_STAGING_PROJECT_ID':'packtook-staging','FIREBASE_TOKEN':'xxx'},clear=True):
            with patch.object(mod.subprocess,'run',side_effect=AssertionError('should not call')):
                with self.assertRaises(ValueError):mod.guard()
    def test_scope_only_staging_functions(self):
        self.assertEqual(len(mod.FUNCTIONS),5)
        self.assertEqual(mod.PROJECT,'packtook-staging')
        self.assertEqual(mod.REGION,'asia-southeast1')
if __name__=='__main__':unittest.main()
