#!/usr/bin/env python3
"""Gate A1 one-pass sanitized hosted-vs-candidate semantic delta report.
Read exact pinned local review ZIP and three existing public static Hosting files.
Never prints raw JS diff, config keys, tokens or secrets, never writes files.
No Auth, Function, Firestore, Firebase Admin or payment calls.
"""
import hashlib,io,json,re,sys,urllib.error
from pathlib import Path
from zipfile import ZipFile
from urllib.request import Request,urlopen
from difflib import SequenceMatcher

ROOT=Path("/tmp/packtook-fast-track-gate-a-review")
ART=ROOT/"gate-a-staging-REVIEW-NO-DEPLOY.zip"
META=ROOT/"gate-a-staging-REVIEW-NO-DEPLOY.manifest.json"
PIN="ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2"
FILES=("firebase-packing-bridge.js","firebase-v4-config.js","index.html")
PUBLIC="https://packtook-staging.web.app/"
def log(k,v):print("PACKTOOK_"+k+"="+str(v),flush=True)
def fetch(n):
 req=Request(PUBLIC+n,headers={"Cache-Control":"no-cache","User-Agent":"PACKTOOK-GateA1-ReadOnly"})
 with urlopen(req,timeout=18) as r:
  if r.status!=200:raise ValueError("unexpected HTTP status")
  x=r.read(2000001)
  if len(x)>2000000:raise ValueError("response oversize")
  return x.decode("utf-8")
def classification(text):
 # Single semantic marker per source-side changed block. Never disclose block contents.
 t=text.lower()
 markers=[]
 for name,pat in (
  ("APPCHECK_INIT",r"appcheck|recaptchaenterprise|istokenautorefresh"),
  ("PROTECTED_CALLABLE_GUARD",r"protectedapi|usageStatus|recordingStatus"),
  ("AUTH_SESSION",r"onauthstatechanged|emailverified|signinwithemailandpassword|signout"),
  ("CALLABLE_DISPATCH",r"httpscallable|\bapi\("),
  ("DEVICE_ID",r"deviceid|localstorage|randomuuid"),
  ("MODULE_IMPORT_OR_CONFIG",r"import |firebaseconfig|getfunctions\("),
 ):
  if re.search(pat,text,re.I):markers.append(name)
 return "+".join(markers[:4]) if markers else "OTHER_CLIENT_BEHAVIOR"
def maps(b):
 return {(a,c,d) for a,c,d in re.findall(
  r'\basync\s+(\w+)\([^)]*\)\s*\{[^\n]*?\b(protectedApi|api)\("([a-zA-Z0-9]+)"\)',b)}
log("CHECK","GATE_A1_REDACTED_HOSTED_CANDIDATE_BRIDGE_DIFF")
stage="LOCAL_ARTIFACT"
count=0
try:
 raw=ART.read_bytes()
 if hashlib.sha256(raw).hexdigest()!=PIN:raise ValueError("archive pin")
 m=json.loads(META.read_text("utf8"))
 if m["sha256_zip"]!=PIN or m["classification"]!="REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY":raise ValueError("manifest")
 with ZipFile(io.BytesIO(raw)) as z:
  candidate={x:z.read(x).decode("utf8") for x in FILES}
 if candidate["firebase-packing-bridge.js"]!=Path("firebase-staging/firebase-packing-bridge.js").read_text("utf8"):
  raise ValueError("bridge mismatch")
 stage="PUBLIC_STATIC_GET"
 hosted={}
 for name in FILES:
  hosted[name]=fetch(name);count+=1
 stage="DELTA_ANALYSIS"
 bc=candidate["firebase-packing-bridge.js"]
 bh=hosted["firebase-packing-bridge.js"]
 blocks=[]
 for op,i1,i2,j1,j2 in SequenceMatcher(None,bc.splitlines(),bh.splitlines(),autojunk=False).get_opcodes():
  if op=="equal":continue
  a="\n".join(bc.splitlines()[i1:i2])
  b="\n".join(bh.splitlines()[j1:j2])
  blocks.append((op,i1+1,j1+1,classification(a),classification(b)))
 log("CANDIDATE_BRIDGE_DIFFERENT_BLOCKS",len(blocks))
 for ix,(operation,local_line,hosted_line,left,right) in enumerate(blocks,1):
  log(f"DIFF_{ix}_KIND",operation.upper())
  log(f"DIFF_{ix}_CANDIDATE_LINE",local_line)
  log(f"DIFF_{ix}_HOSTED_LINE",hosted_line)
  log(f"DIFF_{ix}_CANDIDATE_SEMANTIC",left)
  log(f"DIFF_{ix}_HOSTED_SEMANTIC",right)
 log("CALLABLE_MAPPING_EQUALS_HOSTED","YES" if maps(bc)==maps(bh) else "NO")
 log("NAMED_CALLABLE_COUNT",len(maps(bc)))
 log("INDEX_EQUALS_HOSTED","YES" if candidate["index.html"]==hosted["index.html"] else "NO")
 log("CONFIG_EQUALS_HOSTED","YES" if candidate["firebase-v4-config.js"]==hosted["firebase-v4-config.js"] else "NO")
 log("SOURCE_BRIDGE_GUARDED_READS","YES" if all(s in bc for s in ('protectedApi("usageStatus")','protectedApi("recordingStatus")')) else "NO")
 log("A1_SEMANTIC_DIFF","INVENTORIED_HUMAN_APPROVAL_REQUIRED")
 log("PUBLIC_GET_COUNT",count)
 log("CLOUD_WRITES","0");log("DEPLOY","NOT_PERFORMED");log("FULL_PUBLIC","NO_GO")
 sys.exit(0 if len(blocks)==4 and maps(bc)==maps(bh) else 3)
except Exception as e:
 reason=("LOCAL_FILE_MISSING" if isinstance(e,FileNotFoundError)
         else "PUBLIC_STATIC_GET_ERROR" if isinstance(e,(urllib.error.URLError,TimeoutError))
         else "VALIDATION_OR_UNEXPECTED")
 log("BLOCKED_STAGE",stage);log("BLOCKED_CATEGORY",reason)
 log("PUBLIC_GET_COUNT",count)
 log("CLOUD_WRITES","0");log("DEPLOY","NOT_PERFORMED");log("FULL_PUBLIC","NO_GO")
 sys.exit(2)
