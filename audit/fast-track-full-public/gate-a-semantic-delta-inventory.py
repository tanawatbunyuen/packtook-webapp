#!/usr/bin/env python3
"""Gate A source semantic delta inventory (read-only; not automated code-review approval).
Compares exact candidate archive Bridge/Config/Index to currently hosted staging static
assets. No Auth/AppCheck/Functions invocations; no writes or key/source output.
"""
from pathlib import Path
from zipfile import ZipFile
from urllib.request import Request,urlopen
from html.parser import HTMLParser
import hashlib,re,sys,json,difflib,urllib.error,zipfile

DIR=Path("/tmp/packtook-fast-track-gate-a-review")
ZIP=DIR/"gate-a-staging-REVIEW-NO-DEPLOY.zip"
META=DIR/"gate-a-staging-REVIEW-NO-DEPLOY.manifest.json"
PIN="ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2"
URL="https://packtook-staging.web.app/"
EXPECTED=("index.html","firebase-v4-config.js","firebase-packing-bridge.js")
def show(k,v):print("PACKTOOK_"+k+"="+str(v),flush=True)
def fetch(n):
 r=Request(URL+n,headers={"Cache-Control":"no-cache","User-Agent":"PACKTOOK-GateA-ReadOnlyReview"})
 with urlopen(r,timeout=18) as q:
  if q.status!=200:raise ValueError("http status")
  data=q.read(2000001)
  if len(data)>2000000:raise ValueError("oversize")
  return data.decode("utf8")
def callables(b):
 # Only narrow wrapper mappings in the verified bridge's window public API.
 return re.findall(r'\basync\s+(\w+)\([^)]*\)\s*\{[^\n]*?\b(?:protectedApi|api)\("([a-zA-Z0-9]+)"\)',b)
def index_normalized(s):
 pat=re.compile(r'(<script\b[^>]*\bsrc\s*=\s*)(["\x27])([^"\x27]+)\2',re.I)
 return pat.sub(lambda m:m.group(1)+m.group(2)+m.group(3).split("?")[0]+"?v=MASKED"+m.group(2)
  if re.fullmatch(r'[A-Za-z0-9._/-]+\.js\?v=[A-Za-z0-9._-]+',m.group(3)) else m.group(0),s)
show("CHECK","GATE_A_SOURCE_SEMANTIC_DELTA_INVENTORY")
stage="START"
public_gets=0
try:
 stage="LOCAL_ARCHIVE"
 if hashlib.sha256(ZIP.read_bytes()).hexdigest()!=PIN:raise ValueError("wrong candidate")
 stage="LOCAL_MANIFEST"
 metadata=json.loads(META.read_text("utf8"))
 if metadata.get("sha256_zip")!=PIN or metadata.get("classification")!="REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY":
  raise ValueError("metadata")
 stage="LOCAL_ZIP_ENTRIES"
 with ZipFile(ZIP,"r") as z:
  candidate={n:z.read(n).decode("utf8") for n in EXPECTED}
 hosted={}
 for n in EXPECTED:
  stage="PUBLIC_INDEX_GET" if n=="index.html" else ("PUBLIC_CONFIG_GET" if n=="firebase-v4-config.js" else "PUBLIC_BRIDGE_GET")
  hosted[n]=fetch(n)
  public_gets+=1
 stage="SOURCE_SEMANTIC_COMPARISON"
 local_bridge=candidate["firebase-packing-bridge.js"]
 hosted_bridge=hosted["firebase-packing-bridge.js"]
 source_bridge=Path("firebase-staging/firebase-packing-bridge.js").read_text("utf8")
 if local_bridge!=source_bridge:raise ValueError("bridge not canonical source")
 candidate_calls=dict(callables(local_bridge))
 hosted_calls=dict(callables(hosted_bridge))
 # A mismatch is deliberately reported but NOT papered over.
 mapping_same=candidate_calls==hosted_calls
 only_index_versions=index_normalized(candidate["index.html"])==index_normalized(hosted["index.html"])
 init_before_guard=(local_bridge.find("initializeAppCheck(app,")>=0 and
   local_bridge.find("initializeAppCheck(app,")<local_bridge.find("window.PACKTOOK_FIREBASE="))
 guard_status=all(p in local_bridge for p in ('protectedApi("usageStatus")','protectedApi("recordingStatus")'))
 same_app=bool(re.search(r'getFunctions\s*\(\s*app\s*,\s*"asia-southeast1"\s*\)',local_bridge))
 config_names=re.findall(r'\b([a-zA-Z]+)\s*:',candidate["firebase-v4-config.js"])
 # Don't dump secrets, Firebase API key or code; aggregate only.
 delta=list(difflib.SequenceMatcher(None,local_bridge.splitlines(),hosted_bridge.splitlines()).get_opcodes())
 bridge_changed_blocks=sum(1 for op,_,_,_,_ in delta if op!="equal")
 show("CANDIDATE_INDEX_VS_HOSTED","MATCH" if candidate["index.html"]==hosted["index.html"] else "DRIFT")
 show("INDEX_NORMALIZED_SCRIPT_VERSIONS_ONLY","YES" if only_index_versions else "NO")
 show("CANDIDATE_BRIDGE_VS_HOSTED","MATCH" if local_bridge==hosted_bridge else "DRIFT_REQUIRES_HUMAN_REVIEW")
 show("BRIDGE_CHANGED_BLOCKS",bridge_changed_blocks)
 show("STATUS_GUARDS_SOURCE","PRESERVED" if guard_status else "MISSING")
 show("APPCHECK_INITIALIZATION_BEFORE_PUBLIC_BRIDGE_EXPORT","YES" if init_before_guard else "NO")
 show("SAME_FIREBASE_FUNCTIONS_APP_REGION","YES" if same_app else "NO")
 show("NAMED_CALLABLE_MAPPING_SAME","YES" if mapping_same else "NO")
 show("CANDIDATE_CALLABLE_COUNT",len(candidate_calls))
 show("HOSTED_CALLABLE_COUNT",len(hosted_calls))
 show("CANDIDATE_CONFIG_VS_HOSTED","MATCH" if candidate["firebase-v4-config.js"]==hosted["firebase-v4-config.js"] else "DRIFT_REQUIRES_HUMAN_REVIEW")
 show("SOURCE_REVIEW_CONCLUSION","HUMAN_REVIEW_REQUIRED")
 show("GATE_A1","OPEN")
 show("GATE_A2","REVIEW_ONLY_ARTIFACT_VERIFIED")
 show("GATE_A3","NOT_EXECUTED")
 show("GATE_A4","NOT_EXECUTED")
 show("EXTERNAL_REQUESTS","THREE_PUBLIC_STATIC_GET_ONLY")
 show("PUBLIC_GET_COMPLETED_COUNT",public_gets)
 show("FILE_WRITES","0")
 show("CLOUD_WRITES","0")
 show("DEPLOY","NOT_PERFORMED")
 show("FULL_PUBLIC","NO_GO")
 sys.exit(0 if only_index_versions and guard_status and init_before_guard and same_app else 3)
except Exception as error:
 # Only predefined safe stage and error category are emitted; no URLs,
 # HTTP bodies, public keys, source snippets or credentials.
 category=("HTTP_ERROR" if isinstance(error,urllib.error.HTTPError)
           else "URL_ERROR" if isinstance(error,urllib.error.URLError)
           else "TIMEOUT" if isinstance(error,TimeoutError)
           else "MISSING_LOCAL_FILE" if isinstance(error,FileNotFoundError)
           else "ZIP_INVALID" if isinstance(error,zipfile.BadZipFile)
           else "JSON_INVALID" if isinstance(error,json.JSONDecodeError)
           else "ASSERTION" if isinstance(error,AssertionError)
           else "VALIDATION_ERROR" if isinstance(error,ValueError)
           else "UNEXPECTED_ERROR")
 show("GATE_A_SEMANTIC_DELTA","BLOCKED_INPUT_OR_REQUEST")
 show("BLOCKER_STAGE",stage)
 show("BLOCKER_CATEGORY",category)
 show("PUBLIC_GET_COMPLETED_COUNT",public_gets)
 show("DETAILS","REDACTED")
 show("CLOUD_WRITES","0")
 show("DEPLOY","NOT_PERFORMED")
 show("FULL_PUBLIC","NO_GO")
 sys.exit(2)
