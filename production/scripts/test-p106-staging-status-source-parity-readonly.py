#!/usr/bin/env python3
"""P106 offline mock metadata/GCS archive/status parity checks, zero Cloud."""
import importlib.util,io,json,zipfile,tempfile
from pathlib import Path
p=Path(__file__).with_name("p106-staging-status-source-parity-readonly.py")
spec=importlib.util.spec_from_file_location("p106",p)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
LOCAL=b'exports.recordingStatus=guardedCall(options,async req=>{\n return 1;\n});\nexports.usageStatus=guardedCall(options,async req=>{\n return 2;\n});\n'
def zipped(data=LOCAL,name="index.js"):
 b=io.BytesIO()
 with zipfile.ZipFile(b,"w",compression=zipfile.ZIP_DEFLATED) as z:z.writestr(name,data)
 return b.getvalue()
def meta(name,project="packtook-staging",storage=True):
 return {"name":f"projects/{project}/locations/asia-southeast1/functions/{name}",
  "environment":"GEN_2",
  "buildConfig":{"source":{"storageSource":{"bucket":"source-test-bucket",
    "object":f"{name}.zip","generation":"5"}} if storage else {}}}
for name in m.NAMES:
 assert m.source_ref(name,json.dumps(meta(name)))==("source-test-bucket",name+".zip","5")
 try:m.source_ref(name,json.dumps(meta(name,project="packtook-prod-01")))
 except ValueError:pass
 else:raise AssertionError("prod metadata accepted")
 try:m.source_ref(name,json.dumps(meta(name,storage=False)))
 except ValueError:pass
 else:raise AssertionError("missing source accepted")
assert m.archive_index(zipped())==LOCAL
for data in (b"not a zip",zipped(LOCAL,"not-index.js")):
 try:m.archive_index(data)
 except (ValueError,zipfile.BadZipFile):pass
 else:raise AssertionError("invalid ZIP accepted")
assert m.compare("recordingStatus",LOCAL,LOCAL)==("MATCH","MATCH")
changed=LOCAL.replace(b"return 1;",b"return 3;")
assert m.compare("recordingStatus",changed,LOCAL)==("DIFFERENT","DIFFERENT")
usage_changed=LOCAL.replace(b"return 2;",b"return 4;")
assert m.compare("recordingStatus",usage_changed,LOCAL)==("DIFFERENT","MATCH")
assert m.compare("recordingStatus",b"no exports",LOCAL)==("DIFFERENT","NOT_LOCATED")
calls=[]
def reader(args,timeout=14,binary=False):
 calls.append((args,timeout,binary))
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:
  return json.dumps(meta(args[3]))
 if args[:4]==["gcloud","storage","objects","describe"]:
  return json.dumps({"size":len(zipped()),"generation":"5"})
 if args[:3]==["gcloud","storage","cat"]:
  assert binary is True
  return zipped()
 raise AssertionError("unrecognized command "+str(args))
with tempfile.TemporaryDirectory() as d:
 src=Path(d)/"index.js";src.write_bytes(LOCAL)
 out=m.inspect(reader,src)
 assert out==[("MATCH","MATCH"),("MATCH","MATCH")]
assert len(calls)==7
assert sum(1 for a,_,_ in calls if a[:3]==["gcloud","storage","cat"])==2
def wrong_project(args,timeout=14,binary=False):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("wrong project must stop before any remote reads")
try:m.inspect(wrong_project,Path("/unused"))
except ValueError as e:assert str(e)=="P106_WRONG_ACTIVE_PROJECT"
else:raise AssertionError("wrong project accepted")
def oversized(args,timeout=14,binary=False):
 if args[:4]==["gcloud","storage","objects","describe"]:
  return json.dumps({"size":m.MAX_DOWNLOAD+1,"generation":"5"})
 return reader(args,timeout,binary)
with tempfile.TemporaryDirectory() as d:
 src=Path(d)/"index.js";src.write_bytes(LOCAL)
 try:m.inspect(oversized,src)
 except ValueError as e:assert str(e)=="P106_STORAGE_SIZE_NOT_ALLOWED"
 else:raise AssertionError("oversize allowed")
def generation_drift(args,timeout=14,binary=False):
 if args[:4]==["gcloud","storage","objects","describe"]:
  return json.dumps({"size":len(zipped()),"generation":"6"})
 return reader(args,timeout,binary)
with tempfile.TemporaryDirectory() as d:
 src=Path(d)/"index.js";src.write_bytes(LOCAL)
 try:m.inspect(generation_drift,src)
 except ValueError as e:assert str(e)=="P106_STORAGE_GENERATION_DRIFT"
 else:raise AssertionError("generation drift accepted")
print("P106_HERMETIC_SOURCE_ZIP_PARITY_GUARD=PASS")
