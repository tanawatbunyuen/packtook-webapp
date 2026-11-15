#!/usr/bin/env python3
"""Offline tests: no API keys, no cloud calls, no deployment."""
import importlib.util
import io
import json
import pathlib
import unittest
from unittest.mock import patch

script=pathlib.Path(__file__).with_name("rr-switch-omise-v3-business-charge.py")
spec=importlib.util.spec_from_file_location("switch",script)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def fixture():
    return {
        "metadata":{"name":mod.JOB},
        "spec":{"template":{"spec":{"taskCount":1,"parallelism":1,
          "template":{"spec":{"maxRetries":0,"serviceAccountName":mod.SA,
            "containers":[{"image":mod.IMAGE,"env":[{"name":k,"value":v} for k,v in {
              "RR_STAGING_PROJECT_ID":mod.PROJECT,
              "RR_NO_PRODUCTION_WRITES":"true",
              "RR_PUBLIC_SIGNUP_CLOSED":"true",
              "RR_OMISE_TEST_SECRET_FILE":"/run/secrets/omise-test-secret",
              "RR_ENABLE_OMISE_TEST_READ":"I_AUTHORIZE_TEST_ONLY_READS",
              "RR_OMISE_TEST_CHARGE_ID":mod.OLD_ID,
              "RR_EXPECTED_AMOUNT_SATANG":"29900",
              "RR_EXPECTED_ACCOUNT_ID":"oldOwnerId123",
              "RR_EXPECTED_REQUEST_ID":"oldRequestId123"
            }.items()],
              "volumeMounts":[{"name":"secretvol","mountPath":"/run/secrets"}]}],
            "volumes":[{"name":"secretvol","secret":{"secretName":mod.SECRET,
              "items":[{"key":"1","path":mod.SECRET_FILE}]}}]
        }}}}}}
    }

def response(payload,status=200):
    class Resp:
        def __init__(self):self.status=status
        def __enter__(self):return self
        def __exit__(self,*a):return False
        def read(self,n):return json.dumps(payload).encode()
    return Resp()

def charge(**overrides):
    data={"id":mod.NEW_ID,"livemode":False,"currency":"thb","amount":129000,
      "status":"successful","paid":True,
      "metadata":{"uid":"testOwner123456789","requestId":"testRequest123456789"}}
    data.update(overrides)
    return data

class GuardTests(unittest.TestCase):
 def test_valid_staging_job(self):
    env=mod.parse_job(json.dumps(fixture()))
    self.assertEqual(env["RR_OMISE_TEST_CHARGE_ID"],mod.OLD_ID)
 def test_wrong_project_refused(self):
    f=fixture();f["metadata"]["name"]="packtook-prod-01"
    with self.assertRaises(AssertionError):mod.parse_job(json.dumps(f))
 def test_old_charge_mismatch_refused(self):
    f=fixture()
    for x in f["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]["env"]:
      if x["name"]=="RR_OMISE_TEST_CHARGE_ID":x["value"]=mod.NEW_ID
    with self.assertRaises(AssertionError):mod.parse_job(json.dumps(f))
 def test_image_mutation_refused(self):
    f=fixture();f["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]["image"]="latest"
    with self.assertRaises(AssertionError):mod.parse_job(json.dumps(f))
 def test_secret_mount_removed_refused(self):
    f=fixture();f["spec"]["template"]["spec"]["template"]["spec"]["volumes"]=[]
    with self.assertRaises(AssertionError):mod.parse_job(json.dumps(f))
 def test_valid_new_paid_charge_metadata(self):
    seen=[]
    def opener(request,timeout):
      seen.append((request.full_url,request.get_method(),timeout))
      return response(charge())
    self.assertEqual(mod.verify_provider("skey_test_MOCKONLY",opener),("testOwner123456789","testRequest123456789"))
    self.assertEqual(seen,[(f"https://api.omise.co/charges/{mod.NEW_ID}","GET",15)])
 def test_live_key_rejected_without_http(self):
    with self.assertRaises(AssertionError):
      mod.verify_provider("skey_live_DO_NOT_USE",lambda *a,**k:self.fail("network"))
 def test_not_paid_refused(self):
    with self.assertRaises(AssertionError):
      mod.verify_provider("skey_test_MOCKONLY",lambda *a,**k:response(charge(paid=False)))
 def test_not_test_mode_refused(self):
    with self.assertRaises(AssertionError):
      mod.verify_provider("skey_test_MOCKONLY",lambda *a,**k:response(charge(livemode=True)))
 def test_amount_mismatch_refused(self):
    with self.assertRaises(AssertionError):
      mod.verify_provider("skey_test_MOCKONLY",lambda *a,**k:response(charge(amount=29900)))
 def test_metadata_missing_refused(self):
    with self.assertRaises(AssertionError):
      mod.verify_provider("skey_test_MOCKONLY",lambda *a,**k:response(charge(metadata={})))
 def test_metadata_injection_refused(self):
    with self.assertRaises(AssertionError):
      mod.verify_provider("skey_test_MOCKONLY",lambda *a,**k:response(charge(metadata={"uid":"abc,evil=1","requestId":"testRequest123456789"})))
 def test_http_404_not_bypassed(self):
    with self.assertRaises(AssertionError):
      mod.verify_provider("skey_test_MOCKONLY",lambda *a,**k:response(charge(),status=404))
if __name__=="__main__":unittest.main()
