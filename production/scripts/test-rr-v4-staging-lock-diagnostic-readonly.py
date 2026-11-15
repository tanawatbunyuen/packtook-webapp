#!/usr/bin/env python3
"""Mock-only V4 billing lock diagnostic tests: no cloud APIs."""
import importlib.util
import pathlib
import unittest
p=pathlib.Path(__file__).with_name("rr-v4-staging-lock-diagnostic-readonly.py")
spec=importlib.util.spec_from_file_location("v4lock",p)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
uid="mockOwner123456789";req="mockRequest123456789"
def d(strings=None,ints=None):
    f={k:{"stringValue":v} for k,v in (strings or {}).items()}
    f.update({k:{"integerValue":str(v)} for k,v in (ints or {}).items()})
    return {"fields":f}
def fixtures(status="payment_pending",lock=req):
    charge={"id":mod.link.CHARGE,"livemode":False,"currency":"thb",
            "amount":129000,"paid":True,"status":"successful",
            "metadata":{"uid":uid,"requestId":req}}
    account=d({} if lock is None else {"openBillingRequestId":lock},
              {"billingVersion":0,"reserved":0})
    bill=d({"requestedBy":uid,"omiseChargeId":mod.link.CHARGE,"plan":"Business",
            "status":status},{"amountTHB":1290,"baseBillingVersion":0})
    return charge,account,bill

class LockDiagnostics(unittest.TestCase):
    def check(self,expected,objects=None,other=None):
        self.assertEqual(mod.assess(*(objects or fixtures()),other)[0],expected)
    def test_normal_match(self):self.check("LOCK_AND_BILLING_EXPECTATIONS_MATCH")
    def test_no_lock(self):self.check("LOCK_MISSING",fixtures(lock=None))
    def test_other_lock(self):
        self.check("LOCK_POINTS_TO_DIFFERENT_REQUEST",fixtures(lock="otherRequest000000001"))
    def test_other_lock_active(self):
        self.check("LOCK_POINTS_TO_ACTIVE_REQUEST",fixtures(lock="otherRequest000000001"),
                   d({"status":"payment_pending"}))
    def test_other_lock_completed(self):
        self.check("LOCK_POINTS_TO_COMPLETED_REQUEST",fixtures(lock="otherRequest000000001"),
                   d({"status":"paid"}))
    def test_other_lock_review(self):
        self.check("LOCK_POINTS_TO_REVIEW_REQUEST",fixtures(lock="otherRequest000000001"),
                   d({"status":"payment_review"}))
    def test_original_paid_supersedes_lock(self):
        self.check("BILLING_REQUEST_ALREADY_COMPLETED",fixtures(status="paid",lock=None))
    def test_original_review_supersedes_lock(self):
        self.check("BILLING_REQUEST_REQUIRES_REVIEW",fixtures(status="payment_review",lock=None))
    def test_cancelled_status(self):
        self.check("BILLING_STATUS_NOT_READY",fixtures(status="cancelled"))
    def test_version(self):
        c,a,b=fixtures();a["fields"]["billingVersion"]["integerValue"]="1"
        self.check("BILLING_VERSION_MISMATCH",(c,a,b))
    def test_reserved(self):
        c,a,b=fixtures();a["fields"]["reserved"]["integerValue"]="1"
        self.check("PENDING_VIDEO_RESERVATIONS",(c,a,b))
    def test_reserved_missing(self):
        c,a,b=fixtures();a["fields"].pop("reserved")
        self.check("RESERVATION_COUNT_UNVERIFIED",(c,a,b))
    def test_amount_mismatch(self):
        c,a,b=fixtures();b["fields"]["amountTHB"]["integerValue"]="299"
        self.check("BILLING_CHARGE_OWNER_OR_PLAN_MISMATCH",(c,a,b))
    def test_wrong_metadata_owner(self):
        c,a,b=fixtures();c["metadata"]["uid"]="differentOwner"
        self.check("BILLING_CHARGE_OWNER_OR_PLAN_MISMATCH",(c,a,b))
    def test_live_mode(self):
        c,a,b=fixtures();c["livemode"]=True
        self.check("PROVIDER_CHARGE_MISMATCH",(c,a,b))
    def test_not_paid(self):
        c,a,b=fixtures();c["paid"]=False
        self.check("PROVIDER_PAYMENT_NOT_VERIFIED",(c,a,b))
    def test_no_write_action_any_case(self):
        for args in (fixtures(),fixtures(lock=None),fixtures(status="paid"),
                     fixtures(lock="otherRequest000000001")):
            self.assertIn(mod.assess(*args)[1],{"NO_WRITE_MANUAL_REVIEW","NO_WRITE_AUDIT_ONLY","READ_ONLY_VERIFIED_NO_WRITE_AUTHORIZED"})
if __name__=="__main__":unittest.main()
