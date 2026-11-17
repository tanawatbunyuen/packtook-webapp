#!/usr/bin/env python3
"""Synthetic offline tests; never access Cloud Function sources."""
import importlib.util
import io
import pathlib
import unittest
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-final-logic-delta-classification-readonly.py")
spec=importlib.util.spec_from_file_location("finalclass",p)
v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)

def src(modify=None,shared="function accountIdFor(uid){return uid;}"):
    lines=["const options={region:'asia-southeast1'};",shared]
    for name in v.att.NAMES:
        if name=="recordingStatus":
            handler="const id=uid(req),op=data(req).operationId;\nreturn {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null};"
        elif name=="usageStatus":
            handler="const id=uid(req),ref=await ensureAccount(id);\nreturn {"+",".join(k+":null" for k in v.targeted.TARGETS[name])+"};"
        else:handler="const id=uid(req);\nreturn {status:'ok'};"
        if modify and name==modify[0]:handler=modify[1]
        lines.append("exports."+name+"=onCall(options,async req=>{\n"+handler+"\n});")
    return ("\n".join(lines)+"\n").encode()

class Tests(unittest.TestCase):
    def test_scope_exactly_five(self):
        self.assertEqual(len(v.att.NAMES),5)
    def test_no_change_exact(self):
        a=src()
        self.assertEqual(v.handler_differences(a,a,"recordingStatus")["class"],"EXACT")
        self.assertEqual(v.shared_differences(a,a)["class"],"EXACT")
    def test_auth_change_classified(self):
        a=src()
        b=src(("recordingStatus","const id=ownerRef(req);\nreturn {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null};"))
        r=v.handler_differences(a,b,"recordingStatus")
        self.assertEqual(r["class"],"NON_RETURN_LOGIC_REVIEW")
        self.assertIn("AUTH_TENANCY",r["categories"])
        self.assertEqual(r["blocks"],1)
    def test_data_preparation_change(self):
        a=src()
        b=src(("usageStatus","const id=uid(req),ref=await ownerRef(id);\nreturn {"+",".join(k+":null" for k in v.targeted.TARGETS["usageStatus"])+"};"))
        result=v.handler_differences(a,b,"usageStatus")
        self.assertIn("AUTH_TENANCY",result["categories"])
        self.assertIn("DATA_PREPARATION",result["categories"])
    def test_firestore_read_classification(self):
        self.assertIn("FIRESTORE_READ_PATH",v.classify_lines(["const snap=await ref.collection('recordings').doc(op).get();"]))
    def test_credit_change_classification(self):
        self.assertIn("CREDIT_ACCOUNTING",v.classify_lines(["const remaining=creditAvailable(a);"]))
    def test_shared_drift_flag(self):
        a=src()
        b=src(shared="function accountIdFor(uid){return own(uid);}")
        r=v.shared_differences(a,b)
        self.assertEqual(r["class"],"DRIFT_REVIEW_REQUIRED")
        self.assertGreater(r["blocks"],0)
        self.assertIn("accountIdFor",r["allowlisted_helper_touched"])
    def test_no_unlisted_identifiers_leak(self):
        a=src(shared="function abc(){return 'SECRET_PRIVATE_ABC';}")
        b=src(shared="function abc(){return 'SECRET_PRIVATE_XYZ';}")
        buf=io.StringIO()
        with redirect_stdout(buf):v.report(a,b,"reserveCredit")
        self.assertNotIn("SECRET_PRIVATE",buf.getvalue())
        self.assertNotIn("function abc",buf.getvalue())
        self.assertIn("FUNCTION_GATE: REVIEW_REQUIRED",buf.getvalue())
    def test_contract_signal_not_semantics(self):
        a=src()
        buf=io.StringIO()
        with redirect_stdout(buf):v.report(a,a,"usageStatus")
        self.assertIn("FUNCTIONAL_EQUIVALENCE: NOT_PROVEN",buf.getvalue())
        self.assertIn("RESPONSE_EXPRESSION_SIGNAL: EXACT_EXPRESSIONS",buf.getvalue())
    def test_guarded_impact_of_read_only(self):
        self.assertEqual(set(v.targeted.TARGETS),{"recordingStatus","usageStatus"})
        self.assertNotIn("omise",v.PATTERNS)
    def test_no_risk_category_not_clearance(self):
        self.assertEqual(v.classify_lines(["const z=5;"]),("DATA_PREPARATION",))
        self.assertEqual(v.classify_lines(["// unrecognized"]),())
    def test_early_malformed_fails_closed(self):
        with self.assertRaises(ValueError):
            v.report(b"bad",src(),"recordingStatus")

if __name__=="__main__":unittest.main()
