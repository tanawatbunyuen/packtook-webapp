#!/usr/bin/env python3
"""P109 hermetic static lexical dependency tests; zero Cloud activity."""
import importlib.util
import io
import json
from pathlib import Path
import zipfile
p=Path(__file__).with_name("p109-archived-uid-options-readonly.py")
s=importlib.util.spec_from_file_location("p109",p)
m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
SRC=b'''const options={region:"asia-southeast1",enforceAppCheck:true};
function uid(req){
 if(!req.auth?.uid)throw Error("no auth");
 if(req.auth.token.email_verified!==true)throw Error("email");
 if(req.auth.token.pilot!==true)throw Error("claim");
 return req.auth.uid;
}
exports.recordingStatus=onCall(options,async req=>{
 const id=uid(req);
 return {recordingId:1,status:1,barcode:1,period:1,file:null};
});
exports.usageStatus=onCall(options,async req=>{
 const id=uid(req);const x=await ensureAccount(id);return {plan:"Free"};
});
'''
S=m.classification(SRC)
for name in m.NAMES:
 assert S["functions"][name]["sharedOptions"]=="SHARED_ENFORCE_TRUE_LITERAL"
 assert S["functions"][name]["uidInvocation"]=="YES"
assert S["uid"]["present"]=="FOUND"
assert S["uid"]["auth"]=="AUTH_REFERENCE_PRESENT"
assert S["uid"]["verifiedEmail"]=="EMAIL_VERIFICATION_REFERENCE_PRESENT"
assert S["uid"]["membership"]=="CLAIM_OR_MEMBERSHIP_REFERENCE_PRESENT"
NO_APP=SRC.replace(b"enforceAppCheck:true",b"timeoutSeconds:30")
assert m.classification(NO_APP)["functions"]["usageStatus"]["sharedOptions"]=="SHARED_ENFORCE_NOT_DECLARED"
FALSE=SRC.replace(b"enforceAppCheck:true",b"enforceAppCheck:false")
assert m.classification(FALSE)["functions"]["usageStatus"]["sharedOptions"]=="SHARED_ENFORCE_FALSE_LITERAL"
OTHER=SRC.replace(b"onCall(options,async",b"onCall({...options},async")
assert m.classification(OTHER)["functions"]["usageStatus"]["sharedOptions"]=="NOT_SIMPLE_OPTIONS_IDENTIFIER"
MISSING=SRC.replace(b"function uid(req)",b"function hiddenUid(req)")
assert m.classification(MISSING)["uid"]["present"]=="NOT_LOCATED"
NONAUTH=SRC.replace(b"if(!req.auth?.uid)throw Error(\"no auth\");",b"// removed auth check")
assert m.classification(NONAUTH)["uid"]["auth"]=="AUTH_REFERENCE_PRESENT"
# Lexical presence cannot establish security, since return req.auth.uid remains.
def zipit(data):
 out=io.BytesIO()
 with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:z.writestr("index.js",data)
 return out.getvalue()
raw=zipit(SRC)
calls=[]
def mock(args,timeout=14,binary=False):
 calls.append(args)
 if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
 if args[:3]==["gcloud","functions","describe"]:
  n=args[3]
  return json.dumps({"name":"projects/packtook-staging/locations/asia-southeast1/functions/"+n,
   "environment":"GEN_2","buildConfig":{"source":{"storageSource":{
   "bucket":"test-staging-source","object":n+".zip","generation":"5"}}}})
 if args[:4]==["gcloud","storage","objects","describe"]:
  return json.dumps({"size":len(raw),"generation":"5"})
 if args[:3]==["gcloud","storage","cat"]:
  assert binary is True
  return raw
 raise AssertionError("unexpected call")
rows=m.inspect(mock)
assert len(rows)==2 and len(calls)==9
assert rows[0][1]["functions"]["recordingStatus"]["sharedOptions"]=="SHARED_ENFORCE_TRUE_LITERAL"
def wrong(args,timeout=14,binary=False):
 if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
 raise AssertionError("wrong project must not read source")
try:m.inspect(wrong)
except ValueError as e:assert str(e)=="P109_WRONG_PROJECT"
else:raise AssertionError("wrong project accepted")
print("P109_HERMETIC_ARCHIVED_UID_OPTIONS=PASS")
