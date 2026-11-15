#!/usr/bin/env python3
"""Mock-only V4 paid billing audit guard tests."""
import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).with_name("rr-v4-paid-billing-credit-audit-readonly.py")
spec=importlib.util.spec_from_file_location("paid_audit",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
UID="mockOwner123456789";REQ="mockRequest123456789"
def d(strings=None,ints=None,booleans=None):
 f={k:{"stringValue":v} for k,v in (strings or {}).items()}
 f.update({k:{"integerValue":str(v)} for k,v in (ints or {}).items()})
 f.update({k:{"booleanValue":v} for k,v in (booleans or {}).items()})
 return {"fields":f}
def fixtures():
 charge={"id":m.link.CHARGE,"livemode":False,"paid":True,"status":"successful","amount":129000,"currency":"thb",
   "metadata":{"uid":UID,"requestId":REQ}}
 account=d({"plan":"Business"},{"creditWalletRemaining":4987},{"creditWalletV1":True})
 bill=d({"requestedBy":UID,"omiseChargeId":m.link.CHARGE,"plan":"Business","status":"paid"},
   {"amountTHB":1290,"creditsPurchased":5000,"transferredCredits":20,"balanceAfter":5020})
 audit=d({"action":"subscription_credits_merged","billingRequestId":REQ,
   "omiseChargeId":m.link.CHARGE,"plan":"Business"},
   {"creditsPurchased":5000,"transferredCredits":20,"balanceAfter":5020})
 return charge,account,bill,[audit],True
class TestAudit(unittest.TestCase):
 def check(self,expected,x=None):self.assertEqual(m.audit_result(*(x or fixtures())),expected)
 def test_once(self):self.check("PAID_GRANT_AUDIT_ONE_MATCH_CURRENT_PLAN")
 def test_duplicate(self):
  c,a,b,h,done=fixtures();self.check("AUDIT_GRANT_COUNT_DUPLICATE",(c,a,b,h+h,done))
 def test_missing(self):
  c,a,b,h,done=fixtures();self.check("AUDIT_GRANT_COUNT_NONE",(c,a,b,[],done))
 def test_incomplete(self):
  c,a,b,h,done=fixtures();self.check("AUDIT_LIST_INCOMPLETE",(c,a,b,h,False))
 def test_paid_flag(self):
  c,a,b,h,done=fixtures();c["paid"]=False
  self.check("OMISE_CHARGE_MISMATCH",(c,a,b,h,done))
 def test_wrong_charge(self):
  c,a,b,h,done=fixtures();b["fields"]["omiseChargeId"]["stringValue"]="chrg_test_other"
  self.check("BILLING_PAID_RECORD_MISMATCH",(c,a,b,h,done))
 def test_record_not_paid(self):
  c,a,b,h,done=fixtures();b["fields"]["status"]["stringValue"]="payment_review"
  self.check("BILLING_PAID_RECORD_MISMATCH",(c,a,b,h,done))
 def test_credit_math(self):
  c,a,b,h,done=fixtures();b["fields"]["balanceAfter"]["integerValue"]="9999"
  self.check("BILLING_WALLET_GRANT_MISMATCH",(c,a,b,h,done))
 def test_audit_amount(self):
  c,a,b,h,done=fixtures();h[0]["fields"]["creditsPurchased"]["integerValue"]="1"
  self.check("AUDIT_GRANT_DETAIL_MISMATCH",(c,a,b,h,done))
 def test_spent_wallet_acceptable(self):
  c,a,b,h,done=fixtures();a["fields"]["creditWalletRemaining"]["integerValue"]="1"
  self.check("PAID_GRANT_AUDIT_ONE_MATCH_CURRENT_PLAN",(c,a,b,h,done))
 def test_missing_wallet(self):
  c,a,b,h,done=fixtures();a["fields"].pop("creditWalletRemaining")
  self.check("CURRENT_WALLET_UNAVAILABLE",(c,a,b,h,done))
 def test_account_plan_changed(self):
  c,a,b,h,done=fixtures();a["fields"]["plan"]["stringValue"]="Basic"
  self.check("ACCOUNT_CURRENT_PLAN_CHANGED",(c,a,b,h,done))
 def test_wallet_flag_missing(self):
  c,a,b,h,done=fixtures();a["fields"].pop("creditWalletV1")
  self.check("CURRENT_WALLET_FLAG_MISSING",(c,a,b,h,done))
 def test_page_complete(self):
  calls=[]
  def fetch(url,headers):
   calls.append(url)
   return {"documents":[d({"action":"reserve"})]}
  docs,done=m.list_all_audits("https://example.test/documents/accounts/only",{},fetch)
  self.assertEqual(len(docs),1);self.assertTrue(done)
  self.assertEqual(len(calls),1)
 def test_page_incomplete(self):
  def fetch(url,headers):
   return {"documents":[d({"action":"reserve"})]*50,"nextPageToken":"newtoken"+str(len(url))}
  docs,done=m.list_all_audits("https://example.test/documents/accounts/only",{},fetch)
  self.assertFalse(done)
if __name__=="__main__":unittest.main()
