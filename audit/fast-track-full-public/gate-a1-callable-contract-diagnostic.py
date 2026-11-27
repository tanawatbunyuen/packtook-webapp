#!/usr/bin/env python3
"""Gate A1: read-only, redacted, exact candidate vs hosted bridge callable contract review.
This is an INDEPENDENT diagnostic; does not overwrite the older regex findings.
Reads pinned ZIP + existing public static assets. Never calls real Firebase Functions/Auth.
No changes to candidate, Firebase or public signup.
"""
import hashlib,io,json,re,sys,urllib.error
from pathlib import Path
from urllib.request import Request,urlopen
from zipfile import ZipFile
from difflib import SequenceMatcher

ROOT=Path("/tmp/packtook-fast-track-gate-a-review")
ZIP=ROOT/"gate-a-staging-REVIEW-NO-DEPLOY.zip"
META=ROOT/"gate-a-staging-REVIEW-NO-DEPLOY.manifest.json"
PIN="ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2"
PUBLIC="https://packtook-staging.web.app/firebase-packing-bridge.js"
def report(k,v):print("PACKTOOK_"+k+"="+str(v),flush=True)
def fetch():
 with urlopen(Request(PUBLIC,headers={"Cache-Control":"no-cache","User-Agent":"PACKTOOK-A1-ContractReview"}),timeout=18) as response:
  if response.status!=200:raise ValueError("unexpected HTTP")
  data=response.read(2000001)
  if len(data)>2000000:raise ValueError("large response")
  return data.decode("utf8")
# Accept only named exported async object methods; never execute either JS source.
METHOD=re.compile(r'^\s*async\s+([A-Za-z_$][\w$]*)\s*\(',re.M)
CALL=re.compile(r'(?:protectedApi|api|httpsCallable)\s*\(\s*(?:(?:functions\s*,\s*)?)(["\x27])([A-Za-z][A-Za-z0-9]*)\1\s*\)')
DIRECT=re.compile(r'\b(?:protectedApi|api)\s*\(\s*(["\x27])([A-Za-z][A-Za-z0-9]*)\1\s*\)')
def extract(source):
 # Scope body per named async method until next async method; method wrappers
 # are one line in pinned source; multi-line hosted is supported where simple.
 hits=list(METHOD.finditer(source))
 out={}
 for ix,hit in enumerate(hits):
  body=source[hit.start(): hits[ix+1].start() if ix+1<len(hits) else len(source)]
  vals=[v for _,v in CALL.findall(body)]
  direct=[v for _,v in DIRECT.findall(body)]
  out[hit.group(1)]={"callables":sorted(set(vals)),"direct":sorted(set(direct))}
 return out
def differences(a,b):
 names=sorted(set(a)|set(b))
 return [(name,a.get(name),b.get(name)) for name in names if a.get(name)!=b.get(name)]
report("CHECK","GATE_A1_CALLABLE_CONTRACT_DIAGNOSTIC")
stage="LOCAL"
try:
 raw=ZIP.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError("ZIP drift")
 m=json.loads(META.read_text("utf8"))
 if m.get("sha256_zip")!=PIN or m.get("classification")!="REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY":
  raise ValueError("manifest")
 with ZipFile(io.BytesIO(raw)) as z: candidate=z.read("firebase-packing-bridge.js").decode("utf8")
 if candidate!=Path("firebase-staging/firebase-packing-bridge.js").read_text("utf8"):
  raise ValueError("source bridge drift")
 stage="PUBLIC_GET"
 hosted=fetch()
 stage="ANALYSIS"
 a=extract(candidate);b=extract(hosted)
 changes=differences(a,b)
 # Print method and callable identifiers only, no JS, token, site key, config or URLs.
 report("CANDIDATE_ASYNC_METHOD_COUNT",len(a))
 report("HOSTED_ASYNC_METHOD_COUNT",len(b))
 report("CANDIDATE_STATIC_CALLABLE_BINDINGS",sum(bool(v["callables"]) for v in a.values()))
 report("HOSTED_STATIC_CALLABLE_BINDINGS",sum(bool(v["callables"]) for v in b.values()))
 report("CALLABLE_CONTRACT_DIFFERENT_METHOD_COUNT",len(changes))
 for name,x,y in changes[:32]:
  report("METHOD_DIFF_NAME",name)
  report("METHOD_DIFF_CANDIDATE_CALLABLES",",".join(x["callables"]) if x else "METHOD_MISSING")
  report("METHOD_DIFF_HOSTED_CALLABLES",",".join(y["callables"]) if y else "METHOD_MISSING")
 report("STATUS_GUARDS_CANDIDATE", "YES" if all(q in candidate for q in ('protectedApi("usageStatus")','protectedApi("recordingStatus")')) else "NO")
 report("HOSTED_BRIDGE_SHA256",hashlib.sha256(hosted.encode()).hexdigest())
 report("CANDIDATE_BRIDGE_SHA256",hashlib.sha256(candidate.encode()).hexdigest())
 report("A1_STATUS","HUMAN_SECURITY_REVIEW_REQUIRED")
 report("WARNING","REGEX_STATIC_DIAGNOSTIC_NOT_JS_AST")
 report("REAL_FIREBASE_CALLS","0");report("CLOUD_WRITES","0");report("DEPLOY","NOT_PERFORMED")
 report("PUBLIC_SIGNUP","NOT_MODIFIED");report("FULL_PUBLIC","NO_GO")
 # Contract mismatch need not imply API defect, but prevents automatic clearance.
 sys.exit(0 if not changes and len(a)>=28 and len(b)>=28 else 3)
except Exception as ex:
 category=("LOCAL_FILE_MISSING" if isinstance(ex,FileNotFoundError) else
          "PUBLIC_GET_ERROR" if isinstance(ex,(urllib.error.URLError,TimeoutError)) else
          "VALIDATION_OR_PARSER_ERROR")
 report("BLOCKER_STAGE",stage);report("BLOCKER_CATEGORY",category)
 report("CLOUD_WRITES","0");report("DEPLOY","NOT_PERFORMED");report("FULL_PUBLIC","NO_GO")
 sys.exit(2)
