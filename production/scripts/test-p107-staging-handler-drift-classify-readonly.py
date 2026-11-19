#!/usr/bin/env python3
"""P107 hermetic drift classifier; no Google Cloud interaction."""
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import zipfile
p=Path(__file__).with_name("p107-staging-handler-drift-classify-readonly.py")
spec=importlib.util.spec_from_file_location("p107",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
REMOTE=(b'exports.recordingStatus=onCall(options,async req=>{\n'
 b' const id=uid(req); const snap=await db.collection("accounts").doc(id).get();\n'
 b' return {recordingId:"test",status:"completed",barcode:"demo",period:"2026-11",file:null};\n});\n'
 b'exports.usageStatus=onCall(options,async req=>{\n'
 b' const id=uid(req); const ref=await ensureAccount(id);\n'
 b' return {plan:"Free",limit:20,used:0,reserved:0,remaining:20,walletEnabled:false,'
 b'walletStartingCredits:null,period:"2026-11",openBillingRequestId:null,'
 b'canBuyMore:false,purchaseReason:null,planExpiresAt:null,subscriptionStatus:"free"};\n});\n')
LOCAL=REMOTE.replace(b'=onCall(',b'=guardedCall(')
def zipit(source=REMOTE):
 out=io.BytesIO()
 with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
  z.writestr("index.js",source)
 return out.getvalue()
archive=zipit()
assert m.classify('exports.recordingStatus=onCall(options,async req=>{\n return {status:1};\n});',"recordingStatus")["wrapper"]=="ON_CALL"
a=m.compare("recordingStatus",REMOTE,LOCAL)
assert a["archived"]["wrapper"]=="ON_CALL"
assert a["git"]["wrapper"]=="GUARDED_CALL"
assert not a["wrapperSame"] and not a["handlerTextMatch"]
assert a["archived"]["ownerPath"]=="DIRECT_ACCOUNTS"
assert a["archived"]["outputFieldPresence"]=="ALL_5_STATIC_FIELDS_PRESENT"
b=m.compare("usageStatus",REMOTE,LOCAL)
assert b["archived"]["usesEnsureAccount"] is True
assert b["archived"]["outputFieldPresence"]=="ALL_13_STATIC_FIELDS_PRESENT"
assert b["archived"]["wrapper"]=="ON_CALL"
assert m.similarity_class(None,"a")=="NOT_COMPARABLE"
assert m.compare("usageStatus",REMOTE,REMOTE)["handlerTextMatch"] is True
def metadata(fn):
 return json.dumps({"name":f"projects/packtook-staging/locations/asia-southeast1/functions/{fn}",
   "environment":"GEN_2",
   "buildConfig":{"source":{"storageSource":{"bucket":"test-source-bucket",
     "object":fn+".zip","generation":"5"}}}})
calls=[]
def reader(args,timeout=14,binary=False):
 calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:return metadata(args[3])
 if args[:4]==["gcloud","storage","objects","describe"]:
  return json.dumps({"size":len(archive),"generation":"5"})
 if args[:3]==["gcloud","storage","cat"]:
  assert binary is True
  return archive
 raise AssertionError("unrecognized cloud command")
with tempfile.TemporaryDirectory() as folder:
 f=Path(folder)/"index.js";f.write_bytes(LOCAL)
 results=m.inspect(reader,f)
 assert len(results)==2
 assert results[0][0]=="recordingStatus" and results[1][0]=="usageStatus"
 assert not results[0][1]["wrapperSame"]
 assert len(calls)==9
 assert sum(1 for x in calls if x[:3]==["gcloud","storage","cat"])==2
def denied(args,timeout=14,binary=False):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("unauthorized metadata read")
try:m.inspect(denied,Path("/nonexistent"))
except ValueError as e:assert str(e)=="P107_WRONG_PROJECT"
else:raise AssertionError("non-staging project accepted")
def drift(args,timeout=14,binary=False):
 if args[:4]==["gcloud","storage","objects","describe"]:
  drift.n+=1
  return json.dumps({"size":len(archive),"generation":"5" if drift.n%2==1 else "6"})
 return reader(args,timeout,binary)
drift.n=0
with tempfile.TemporaryDirectory() as folder:
 f=Path(folder)/"index.js";f.write_bytes(LOCAL)
 try:m.inspect(drift,f)
 except ValueError as e:assert str(e)=="P107_GENERATION_CHANGED"
 else:raise AssertionError("GCS source generation changed undetected")
print("P107_HERMETIC_REDACTED_HANDLER_DRIFT=PASS")
