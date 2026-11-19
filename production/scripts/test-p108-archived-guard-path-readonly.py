#!/usr/bin/env python3
"""P108 hermetic negative and positive tests for redacted guard classification."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import zipfile

file=Path(__file__).with_name("p108-archived-guard-path-readonly.py")
spec=importlib.util.spec_from_file_location("p108",file)
p108=importlib.util.module_from_spec(spec);spec.loader.exec_module(p108)

ARCHIVE=(
 b'function uid(req){if(!req.auth)throw Error("denied");return req.auth.uid;}\n'
 b'exports.recordingStatus=onCall(options,async req=>{\n'
 b' const id=uid(req);const rec=await ownerRef(id);\n'
 b' return {recordingId:"demo",status:"completed",barcode:"B",period:"2026-11",file:null};\n});\n'
 b'exports.usageStatus=onCall({...options,enforceAppCheck:true},async req=>{\n'
 b' const id=uid(req);const ref=await ensureAccount(id);\n'
 b' return usageResponse(await ref.get());\n});\n')
GIT=(
 b'function uid(req){return req.auth.uid;}\n'
 b'exports.recordingStatus=guardedCall(options,async req=>{\n'
 b' const id=uid(req);const ref=await ownerRef(id);\n'
 b' return {status:"completed"};\n});\n'
 b'exports.usageStatus=guardedCall(options,async req=>{\n'
 b' const id=uid(req);const ref=await ensureAccount(id);\n'
 b' return {plan:"Free",limit:20,remaining:20};\n});\n')
def as_zip(source=ARCHIVE):
 buf=io.BytesIO()
 with zipfile.ZipFile(buf,"w",zipfile.ZIP_DEFLATED) as z:z.writestr("index.js",source)
 return buf.getvalue()
R=p108.inspect_archived(ARCHIVE,"recordingStatus")
assert R["handler"]=="FOUND"
assert R["appCheckOption"]=="OPTION_NOT_INLINE"
assert R["authPath"]=="UID_HELPER_CALLED"
assert R["authHelper"]=="UID_FUNCTION_FOUND"
assert R["ensureAccountUsed"] is False
U=p108.inspect_archived(ARCHIVE,"usageStatus")
assert U["appCheckOption"]=="INLINE_TRUE_LITERAL"
assert U["usageResult"]=="INDIRECT_RETURN_PRESENT"
assert U["ensureAccountUsed"] is True
assert p108.inspect_archived(GIT,"usageStatus")["usageResult"]=="INLINE_OBJECT_PRESENT"
assert p108.inspect_archived(b"nothing here","recordingStatus")["handler"]=="NOT_LOCATED"
bad_inline=ARCHIVE.replace(b"enforceAppCheck:true",b"enforceAppCheck:false")
assert p108.inspect_archived(bad_inline,"usageStatus")["appCheckOption"]=="INLINE_FALSE_LITERAL"
inline_auth=(b'exports.recordingStatus=onCall(options,async req=>{\n'
 b' if(!req.auth)throw Error("no");return {status:"done"};\n});')
assert p108.inspect_archived(inline_auth,"recordingStatus")["authPath"]=="DIRECT_AUTH_REFERENCE"
no_auth=(b'exports.recordingStatus=onCall(options,async req=>{\n return {status:"done"};\n});')
assert p108.inspect_archived(no_auth,"recordingStatus")["authPath"]=="NO_AUTH_REFERENCE_IN_BODY"
# Explicit auth refs are only lexical indicators, never "security pass".
assert "EFFECTIVE" not in p108.inspect_archived(inline_auth,"recordingStatus")["authPath"]
zipbytes=as_zip()
read_calls=[]
def mock(args,timeout=14,binary=False):
 read_calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:
  name=args[3]
  return json.dumps({"name":f"projects/packtook-staging/locations/asia-southeast1/functions/{name}",
    "environment":"GEN_2","buildConfig":{"source":{"storageSource":{
    "bucket":"test-bucket","object":name+".zip","generation":"5"}}}})
 if args[:4]==["gcloud","storage","objects","describe"]:
  return json.dumps({"size":len(zipbytes),"generation":"5"})
 if args[:3]==["gcloud","storage","cat"]:
  assert binary is True
  return zipbytes
 raise AssertionError("unexpected gcloud command")
with tempfile.TemporaryDirectory() as d:
 path=Path(d)/"index.js";path.write_bytes(GIT)
 result=p108.inspect(mock,path)
 assert len(result)==2
 assert result[0][0]=="recordingStatus"
 assert result[1][0]=="usageStatus"
 assert result[1][1]["appCheckOption"]=="INLINE_TRUE_LITERAL"
 assert result[1][2]["usageResult"]=="INLINE_OBJECT_PRESENT"
assert len(read_calls)==9
def wrong(args,timeout=14,binary=False):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("never read remote data on wrong project")
try:p108.inspect(wrong,Path("/unavailable"))
except ValueError as exc:assert str(exc)=="P108_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project accepted")
print("P108_HERMETIC_ARCHIVED_GUARD_CLASSIFICATION=PASS")
