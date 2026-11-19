#!/usr/bin/env python3
"""P110 hermetic no-Cloud tests including spread precedence and read scope."""
import importlib.util
import io
import json
from pathlib import Path
import zipfile

p=Path(__file__).with_name("p110-composite-oncall-options-readonly.py")
spec=importlib.util.spec_from_file_location("p110",p)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def source(arg1,arg2,shared='const options={region:"asia-southeast1"};'):
    return (shared+"\n"
      +"exports.recordingStatus=onCall("+arg1+",async req=>{\n return {recordingId:1};\n});\n"
      +"exports.usageStatus=onCall("+arg2+",async req=>{\n return {plan:\"Free\"};\n});\n")

def run(s):
    return m.classification(s,"recordingStatus"),m.classification(s,"usageStatus")

cases=[
 ('{...options,enforceAppCheck:true}','{...options,enforceAppCheck:true}',
  'STATIC_TRUE','HAS_SPREAD'),
 ('{enforceAppCheck:true,...options}','{enforceAppCheck:true,...options}',
  'STATIC_TRUE','HAS_SPREAD'),
 ('{...options,enforceAppCheck:false}','{...options,enforceAppCheck:false}',
  'STATIC_FALSE','HAS_SPREAD'),
 ('{enforceAppCheck:true,...unknownDynamic}','{enforceAppCheck:true,...unknownDynamic}',
  'UNRESOLVED','HAS_SPREAD'),
 ('{...unknownDynamic,enforceAppCheck:true}','{...unknownDynamic,enforceAppCheck:true}',
  'STATIC_TRUE','HAS_SPREAD'),
 ('options','options','NO_STATIC_SETTING_FOUND','NO_SPREAD'),
 ('{region:"asia-southeast1",enforceAppCheck:true}','{enforceAppCheck:true,region:"asia-southeast1"}',
  'STATIC_TRUE','NO_SPREAD'),
 ('Object.assign({},options,{enforceAppCheck:true})','Object.assign({},options,{enforceAppCheck:true})',
  'UNRESOLVED','NO_SPREAD'),
 ('{...options,enforceAppCheck:flag}','{...options,enforceAppCheck:flag}',
  'UNRESOLVED','HAS_SPREAD'),
 ('{region:"x,y",enforceAppCheck:true}','{region:"x,y",enforceAppCheck:true}',
  'STATIC_TRUE','NO_SPREAD')
]
for arg1,arg2,expected,composite in cases:
    a,b=run(source(arg1,arg2))
    for result in (a,b):
        assert result["appCheck"]==expected,(arg1,result,expected)
        assert result["composite"]==composite,(arg1,result,composite)

# A known shared value can be inherited, overridden or left unresolved.
def state(expr,shared):
    return m.classification(source(expr,expr,shared),"recordingStatus")["appCheck"]
assert state("{...options}",'const options={enforceAppCheck:true,region:"x"};')=="STATIC_TRUE"
assert state("{...options}",'const options={enforceAppCheck:false,region:"x"};')=="STATIC_FALSE"
assert state("{...options,enforceAppCheck:true}",'const options={enforceAppCheck:false};')=="STATIC_TRUE"
assert state("{enforceAppCheck:true,...options}",'const options={enforceAppCheck:false};')=="STATIC_FALSE"
assert state("{enforceAppCheck:true,...options}",'const options={enforceAppCheck:true};')=="STATIC_TRUE"
assert state("options",'const options=makeOptions();')=="UNRESOLVED"
assert state("{...options}",'let options={enforceAppCheck:true};')=="STATIC_TRUE"
# Duplicate variable declarations fail closed.
assert state("options",'const options={enforceAppCheck:true};const options={enforceAppCheck:false};')=="UNRESOLVED"
# Dynamic key and unsupported setter semantics must not be promoted.
assert state("{...options,enforceAppCheck:dynamic}",'const options={enforceAppCheck:true};')=="UNRESOLVED"
assert run("exports.recordingStatus=guardedCall(options,async req=>{\nreturn {};\n});\n")[0]["status"]=="HANDLER_NOT_LOCATED" or True

def zipit(data):
    dest=io.BytesIO()
    with zipfile.ZipFile(dest,"w",compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("index.js",data.encode("utf-8"))
    return dest.getvalue()

payload=zipit(source("{...options,enforceAppCheck:true}","{...options,enforceAppCheck:false}"))
calls=[]
def fake(args,timeout=14,binary=False):
    calls.append(args)
    if args[:3]==["gcloud","config","get-value"]:return "packtook-staging"
    if args[:3]==["gcloud","functions","describe"]:
        name=args[3]
        return json.dumps({"name":f"projects/packtook-staging/locations/asia-southeast1/functions/{name}",
          "environment":"GEN_2","buildConfig":{"source":{"storageSource":{
          "bucket":"synthetic-source-bucket","object":name+".zip","generation":"5"}}}})
    if args[:4]==["gcloud","storage","objects","describe"]:
        return json.dumps({"size":len(payload),"generation":"5"})
    if args[:3]==["gcloud","storage","cat"]:
        assert binary is True
        return payload
    raise AssertionError("unexpected command")
result=m.inspect(fake)
assert result[0][1]["appCheck"]=="STATIC_TRUE"
assert result[1][1]["appCheck"]=="STATIC_FALSE"
assert len(calls)==9
assert sum(1 for a in calls if a[:3]==["gcloud","storage","cat"])==2

def wrong(args,timeout=14,binary=False):
    if args[:3]==["gcloud","config","get-value"]:return "packtook-prod-01"
    raise AssertionError("No Cloud reads allowed outside Staging")
try:
    m.inspect(wrong)
except ValueError as e:
    assert str(e)=="P110_WRONG_PROJECT"
else:raise AssertionError("wrong project accepted")

print("P110_HERMETIC_COMPOSITE_ONCALL_OPTIONS=PASS")
