#!/usr/bin/env python3
"""Synthetic, offline-only deployment attribution tests."""
import importlib.util
import io
import pathlib
import unittest
from contextlib import redirect_stdout
p=pathlib.Path(__file__).with_name("rr-v7-deployment-delta-attribution-readonly.py")
spec=importlib.util.spec_from_file_location("v7attribution",p)
v=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)

def make(helper="function uid(req){return req.auth.uid;}",use="const a=1;",
         shared="exports.otherCallable=onCall(options,async req=>{\n return 1;\n});",
         record=None):
    lines=['"use strict";',helper,"function ownerRef(uid){return uid;}",
           "const options={region:'asia-southeast1'};"]
    for name in v.att.NAMES:
        code=use
        if name=="recordingStatus":
            code=(record if record is not None else "const snap=await getDoc();")+"\n return {recordingId:op,status:r.status,barcode:r.barcode,period:r.period,file:r.file||null};"
        if name=="usageStatus":
            code="const a=await getData();\n return {"+",".join(k+":null" for k in v.target.TARGETS[name])+"};"
        lines.append("exports."+name+"=onCall(options,async req=>{\n "+code+"\n});")
    lines.append(shared)
    return ("\n".join(lines)+"\n").encode()

class Tests(unittest.TestCase):
    def test_exact(self):
        a=make()
        self.assertEqual(v.attribute(a,a),[])
    def test_other_callable(self):
        a=make()
        b=make(shared="exports.otherCallable=onCall(options,async req=>{\n return 2;\n});")
        self.assertIn(("OTHER_EXPORTED_FUNCTION","EXECUTABLE_OR_UNRESOLVED_DRIFT"),v.attribute(a,b))
    def test_helper_changed(self):
        a=make()
        b=make(helper="function uid(req){return req.auth.email;}")
        self.assertIn(("CRITICAL_HELPER","EXECUTABLE_OR_UNRESOLVED_DRIFT"),v.attribute(a,b))
    def test_recording_nonreturn_expression(self):
        a=make()
        b=make(record="const snap=await otherDoc();")
        self.assertEqual(v.handler_details(a,b,"recordingStatus")[0],"EXECUTABLE_OR_UNRESOLVED_DRIFT")
        self.assertEqual(v.handler_details(a,b,"recordingStatus")[1],"EXACT_EXPRESSIONS")
    def test_header_change(self):
        a=make()
        b=a.replace(b'"use strict";',b'"use strict";\n// note')
        self.assertIn(("MODULE_HEADER","COMMENT_OR_BLANK_LINES_ONLY"),v.attribute(a,b))
    def test_blank_whitespace_class_not_semantic_proof(self):
        self.assertEqual(v.change_class("const n=1;","const   n = 1;"),"WHITESPACE_ONLY_TEXT_NOT_SEMANTIC_PROOF")
    def test_string_spaces_not_claim_equivalent(self):
        self.assertNotEqual(v.change_class('const msg="a b";','const msg="ab";'),"EXACT")
    def test_missing_declaration(self):
        self.assertEqual(v.change_class(None,"function n(){}"),"DECLARATION_ADDED_OR_REMOVED")
    def test_duplicate_declaration_fail_closed(self):
        with self.assertRaises(ValueError):
            v.regions(b"function uid(req){}\nfunction uid(req){}\n")
    def test_empty_declaration_fail_closed(self):
        with self.assertRaises(ValueError):
            v.regions(b"not a JS declaration")
    def test_redaction(self):
        a=make()
        b=make(shared="exports.PRIVATE_KEY=onCall(options,async req=>{\n const SECRET_VALUE='XXX';\n});")
        out=io.StringIO()
        with redirect_stdout(out):v.report(a,b,"reserveCredit")
        self.assertNotIn("PRIVATE_KEY",out.getvalue())
        self.assertNotIn("SECRET_VALUE",out.getvalue())
        self.assertIn("FUNCTION_GATE: REVIEW_REQUIRED",out.getvalue())
    def test_scope(self):
        self.assertEqual(len(v.att.NAMES),5)
        self.assertEqual(len(v.target.TARGETS),2)

if __name__=="__main__":unittest.main()
