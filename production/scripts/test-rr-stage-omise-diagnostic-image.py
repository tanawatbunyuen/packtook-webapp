#!/usr/bin/env python3
import importlib.util, pathlib, unittest, copy
file=pathlib.Path(__file__).with_name("rr-stage-omise-diagnostic-image.py")
spec=importlib.util.spec_from_file_location("guard",file)
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
SA=guard.SA
def job():
 return {"metadata":{"name":guard.JOB},"spec":{"template":{"spec":{
  "parallelism":1,"taskCount":1,"template":{"spec":{
    "maxRetries":0,"serviceAccountName":SA,
    "containers":[{"image":guard.REPO+"@"+guard.ORIGINAL,
      "env":[{"name":k,"value":v} for k,v in {
       "RR_STAGING_PROJECT_ID":"packtook-staging",
       "RR_NO_PRODUCTION_WRITES":"true",
       "RR_PUBLIC_SIGNUP_CLOSED":"true",
       "RR_OMISE_TEST_SECRET_FILE":"/run/secrets/omise-test-secret",
       "RR_ENABLE_OMISE_TEST_READ":"I_AUTHORIZE_TEST_ONLY_READS",
       "RR_OMISE_TEST_CHARGE_ID":"chrg_test_12345678",
       "RR_EXPECTED_ACCOUNT_ID":"account0001",
       "RR_EXPECTED_REQUEST_ID":"request0001",
       "RR_EXPECTED_AMOUNT_SATANG":"29900"}.items()],
      "volumeMounts":[{"name":"secret","mountPath":"/run/secrets"}]}],
    "volumes":[{"name":"secret","secret":{"secretName":guard.SECRET,
      "items":[{"key":"1","path":guard.SECRET_FILE}]}}]
 }}}}}}
class GuardTests(unittest.TestCase):
 def test_valid(self):self.assertTrue(guard.validate_job(job()))
 def test_reject_prod_env(self):
  with self.assertRaises(ValueError):guard.guard_env({"RR_STAGING_PROJECT_ID":"packtook-prod-01"})
 def test_reject_live_secret_env(self):
  with self.assertRaises(ValueError):guard.guard_env({"RR_STAGING_PROJECT_ID":"packtook-staging","OMISE_SECRET_KEY":"abc"})
 def test_valid_env(self):guard.guard_env({"RR_STAGING_PROJECT_ID":"packtook-staging"})
 def test_wrong_image(self):
  x=job();x["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]["image"]="incorrect"
  with self.assertRaisesRegex(ValueError,"EXISTING_IMAGE_UNEXPECTED"):guard.validate_job(x)
 def test_unexpected_service_account(self):
  x=job();x["spec"]["template"]["spec"]["template"]["spec"]["serviceAccountName"]="default"
  with self.assertRaisesRegex(ValueError,"RUNTIME_SA_MISMATCH"):guard.validate_job(x)
 def test_secret_mount_removed(self):
  x=job();x["spec"]["template"]["spec"]["template"]["spec"]["volumes"]=[]
  with self.assertRaisesRegex(ValueError,"SECRET_MOUNT_MISMATCH"):guard.validate_job(x)
 def test_no_retries(self):
  x=job();x["spec"]["template"]["spec"]["template"]["spec"]["maxRetries"]=3
  with self.assertRaisesRegex(ValueError,"JOB_RETRIES_NOT_ZERO"):guard.validate_job(x)
 def test_requires_one_task(self):
  x=job();x["spec"]["template"]["spec"]["taskCount"]=4
  with self.assertRaisesRegex(ValueError,"TASK_COUNT_NOT_ONE"):guard.validate_job(x)
 def test_requires_expected_charge(self):
  x=job();e=x["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]["env"]
  x["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]["env"]=[v for v in e if v["name"]!="RR_OMISE_TEST_CHARGE_ID"]
  with self.assertRaisesRegex(ValueError,"MISSING_CHARGE_EXPECTATION"):guard.validate_job(x)
 def test_required_public_closed(self):
  x=job()
  e=x["spec"]["template"]["spec"]["template"]["spec"]["containers"][0]["env"]
  next(v for v in e if v["name"]=="RR_PUBLIC_SIGNUP_CLOSED")["value"]="false"
  with self.assertRaisesRegex(ValueError,"JOB_ENV_MISMATCH_RR_PUBLIC_SIGNUP_CLOSED"):guard.validate_job(x)
if __name__=="__main__":unittest.main()
