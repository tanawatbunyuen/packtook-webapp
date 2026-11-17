#!/usr/bin/env python3
"""One-pass orchestration synthetic tests: no Staging network or credits."""
import importlib.util
import io
import pathlib
import unittest
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-one-pass-readonly.py")
spec=importlib.util.spec_from_file_location("onepass",p)
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

def source(other="return 1;"):
    lines=['"use strict";',"const options={region:'asia-southeast1'};",
           "function uid(req){return req.auth.uid}",
           "function validOp(id){return true}",
           "async function ownerRef(id){return id}",
           "async function ensureAccount(id){return id}",
           "function subscriptionState(a){return 'active'}",
           "function creditAvailable(a){return 1}",
           "function walletEnabled(a){return true}",
           "function pendingReservations(a){return 1}",
           "function barcodeKey(b){return b}",
           "function validDevice(d){return true}",
           "function purchaseDecision(a){return {allowed:true}}"]
    for name in v.att.NAMES:
        if name=="recordingStatus":
            body="const id=uid(req);\n return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:null};"
        elif name=="usageStatus":
            body="const id=uid(req);\n return {"+",".join(k+":null" for k in v.target.TARGETS[name])+"};"
        else:
            body="const id=uid(req);\n return {status:'ok'};"
        lines.append("exports."+name+"=onCall(options,async req=>{\n "+body+"\n});")
    lines.append("exports.extra=onCall(options,async req=>{\n "+other+"\n});")
    return ("\n".join(lines)+"\n").encode()

class Tests(unittest.TestCase):
    def test_same_source(self):
        a=source()
        r=v.checked(a,a,"recordingStatus")
        self.assertEqual(r["handler"],"EXACT")
        self.assertEqual(r["helper_drift"],0)
        self.assertEqual(r["response"],"EXACT_EXPRESSIONS")
    def test_other_export_drift(self):
        a=source()
        b=source(other="return 2;")
        r=v.checked(a,b,"reserveCredit")
        self.assertEqual(r["ops"]["OTHER_EXPORTED_FUNCTION","MODIFIED"],1)
        self.assertEqual(r["handler"],"EXACT")
    def test_single_archive_load_per_function(self):
        a=source()
        pins={name:("bucket","source.zip",str(i+1)) for i,name in enumerate(v.att.NAMES)}
        count=[]
        def load(pin):
            count.append(pin)
            return b"fake_zip_bytes"
        original=v.att.handler_from_zip
        v.att.handler_from_zip=lambda blob:a
        try:
            stream=io.StringIO()
            with redirect_stdout(stream):
                verified,reads,elapsed=v.inspect(a,{n:{"state":"ACTIVE","buildConfig":{"source":{"storageSource":{"bucket":"gcf-v2-sources-123-asia-southeast1","object":"source.zip","generation":str(i+1)}}}} for i,n in enumerate(v.att.NAMES)},loader=load,clock=lambda:1.0)
            self.assertEqual(verified,5)
            self.assertEqual(reads,5)
            self.assertEqual(len(count),5)
        finally:
            v.att.handler_from_zip=original
    def test_missing_pinned_fails_closed(self):
        stream=io.StringIO()
        with redirect_stdout(stream):
            checked,reads,ms=v.inspect(source(),{},loader=lambda _:source())
        self.assertEqual(checked,0)
        self.assertEqual(reads,0)
        self.assertIn("NOT_VERIFIABLE",stream.getvalue())
    def test_redacted_output(self):
        a=source()
        b=source(other="return 'PRIVATE_DEPLOYED_SECRET';")
        stream=io.StringIO()
        with redirect_stdout(stream):v.emit("reserveCredit",v.checked(a,b,"reserveCredit"))
        self.assertNotIn("PRIVATE_DEPLOYED_SECRET",stream.getvalue())
        self.assertIn("FUNCTION_GATE: REVIEW_REQUIRED",stream.getvalue())
    def test_security_gate_never_true(self):
        stream=io.StringIO()
        with redirect_stdout(stream):v.emit("usageStatus",v.checked(source(),source(),"usageStatus"))
        self.assertNotIn("GO_RELEASE",stream.getvalue())
if __name__=="__main__":unittest.main()
