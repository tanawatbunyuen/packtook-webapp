#!/usr/bin/env python3
"""Offline mock-only assertions for V4 read-only linkage guard."""
import importlib.util
import pathlib
import unittest
path=pathlib.Path(__file__).with_name("rr-v4-staging-billing-linkage-readonly.py")
spec=importlib.util.spec_from_file_location("preflight",path)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

UID="mockOwner123456789"
REQ="mockRequest123456789"
def d(strings=None,ints=None):
 fields={k:{"stringValue":v} for k,v in (strings or {}).items()}
 fields.update({k:{"integerValue":str(v)} for k,v in (ints or {}).items()})
 return {"fields":fields}
def inputs():
 charge={"id":mod.CHARGE,"livemode":False,"currency":"thb","amount":129000,
   "paid":True,"status":"successful","metadata":{"uid":UID,"requestId":REQ}}
 account=d({"openBillingRequestId":REQ},{"billingVersion":0})
 ticket=d({"requestedBy":UID,"omiseChargeId":mod.CHARGE,"plan":"Business",
     "status":"payment_pending"},{"amountTHB":1290,"baseBillingVersion":0})
 return charge,account,ticket
class Check(unittest.TestCase):
 def test_link_matches(self):self.assertEqual(mod.validate_link(*inputs()),"STAGING_BILLING_LINKAGE_MATCH")
 def test_no_uid_match(self):
  c,a,t=inputs();c["metadata"]["uid"]="anotherCustomer123"
  self.assertEqual(mod.validate_link(c,a,t),"BILLING_OWNER_OR_CHARGE_MISMATCH")
 def test_wrong_charge(self):
  c,a,t=inputs();t["fields"]["omiseChargeId"]["stringValue"]="chrg_test_OTHER"
  self.assertEqual(mod.validate_link(c,a,t),"BILLING_OWNER_OR_CHARGE_MISMATCH")
 def test_amount(self):
  c,a,t=inputs();t["fields"]["amountTHB"]["integerValue"]="299"
  self.assertEqual(mod.validate_link(c,a,t),"BILLING_PLAN_OR_AMOUNT_MISMATCH")
 def test_plan(self):
  c,a,t=inputs();t["fields"]["plan"]["stringValue"]="Basic"
  self.assertEqual(mod.validate_link(c,a,t),"BILLING_PLAN_OR_AMOUNT_MISMATCH")
 def test_lock(self):
  c,a,t=inputs();a["fields"]["openBillingRequestId"]["stringValue"]="otherRequest0000000"
  self.assertEqual(mod.validate_link(c,a,t),"BILLING_LOCK_NOT_MATCHED")
 def test_revision(self):
  c,a,t=inputs();a["fields"]["billingVersion"]["integerValue"]="2"
  self.assertEqual(mod.validate_link(c,a,t),"BILLING_VERSION_MISMATCH")
 def test_already_paid(self):
  c,a,t=inputs();t["fields"]["status"]["stringValue"]="paid"
  self.assertEqual(mod.validate_link(c,a,t),"ALREADY_PAID_REQUIRES_AUDIT")
 def test_unpaid(self):
  c,a,t=inputs();c["paid"]=False
  self.assertEqual(mod.validate_link(c,a,t),"CHARGE_NOT_PAID_OR_AMOUNT_MISMATCH")
 def test_live(self):
  c,a,t=inputs();c["livemode"]=True
  self.assertEqual(mod.validate_link(c,a,t),"CHARGE_ID_OR_MODE_MISMATCH")
 def test_bad_metadata(self):
  c,a,t=inputs();c["metadata"]["requestId"]="wrong,unsafe"
  self.assertEqual(mod.validate_link(c,a,t),"CHARGE_REQUEST_INVALID")
if __name__=="__main__":unittest.main()
