#!/usr/bin/env python3
"""P231.170 — two-build reproducibility + JS syntax, transient offline candidate.
Only public Hosting static GET for hosted Index/Bridge/Config, no Firebase APIs.
Never print/copy any site key into Git source or stdout. No deployment.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request,urlopen
import hashlib,json,os,re,shutil,subprocess,sys
ROOT=Path("firebase-staging")
URL="https://packtook-staging.web.app/"
JS=("firebase-packing-bridge.js","video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js","firebase-v4-config.js")
def emit(k,v):print(f"P231_{k}={v}",flush=True)
def fetch(name):
 req=Request(URL+name,method="GET",headers={"Accept":"*/*","Cache-Control":"no-cache",
   "User-Agent":"PACKTOOK-P231170-ReadOnly"})
 with urlopen(req,timeout=18) as response:
  if response.status!=200:raise ValueError("asset status")
  payload=response.read(2000001)
  if len(payload)>2000000:raise ValueError("oversized asset")
  return payload.decode("utf8")
def normalized_index(text):
 pattern=re.compile(r'(<script\b[^>]*\bsrc\s*=\s*)(["\x27])([^"\x27]+)\2',re.I)
 def replace(match):
  prefix,quote,src=match.groups()
  if not re.fullmatch(r"[A-Za-z0-9._/-]+\.js\?v=[A-Za-z0-9._-]+",src):
   return match.group(0)
  return prefix+quote+src.partition("?")[0]+"?v=MASKED"+quote
 return pattern.sub(replace,text)
def files(root):
 items={}
 for base,dirs,names in os.walk(root,topdown=True,followlinks=False):
  basepath=Path(base)
  kept=[]
  for name in dirs:
   p=basepath/name
   if p.is_symlink():raise ValueError("symlink dir")
   if not name.startswith(".") and name!="node_modules":kept.append(name)
  dirs[:]=kept
  for name in names:
   p=basepath/name
   rel=p.relative_to(root).as_posix()
   if name.startswith(".") or name=="firebase.json":continue
   if p.is_symlink() or not p.is_file():raise ValueError("unsafe file")
   if p.stat().st_size>25000000:raise ValueError("large file")
   items[rel]=p.read_bytes()
   if len(items)>10000:raise ValueError("too many files")
 return items
def manifest_dict(root):
 result={}
 for name,data in sorted(files(root).items()):
  result[name]=hashlib.sha256(data).digest()
 return result
emit("CHECK","STAGING_REPRODUCIBLE_TRANSIENT_BUILD_AND_JS_SYNTAX")
try:
 hosting=json.loads(Path("firebase.json").read_text("utf8"))["hosting"]
 if hosting.get("public")!="firebase-staging":raise ValueError("hosting scope")
 if set(hosting.get("ignore",[]))!={"firebase.json","**/.*","**/node_modules/**"}:raise ValueError("ignore list")
 original=files(ROOT)
 localindex=(ROOT/"index.html").read_text("utf8")
 hosted_index=fetch("index.html")
 hosted_bridge=fetch("firebase-packing-bridge.js")
 hosted_config=fetch("firebase-v4-config.js")
 if normalized_index(localindex)!=normalized_index(hosted_index):raise ValueError("index content drift")
 if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',hosted_config):raise ValueError("hosted project")
 m=re.search(r'new\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)',hosted_bridge)
 if not m or not re.fullmatch(r"[A-Za-z0-9_-]{20,300}",m.group(2)):raise ValueError("key shape")
 key=m.group(2)
 local_cfg=(ROOT/"firebase-v4-config.js").read_text("utf8")
 pat=r'(export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*)(["\x27])\2\s*;'
 if len(list(re.finditer(pat,local_cfg)))!=1:raise ValueError("local config key baseline")
 if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',local_cfg):raise ValueError("local project")
 node=subprocess.run(["node","--version"],capture_output=True,text=True,timeout=10)
 if node.returncode:raise ValueError("node unavailable")
except Exception:
 emit("GATE","BLOCKED_INPUT_OR_PREREQUISITE")
 emit("DETAILS","REDACTED")
 emit("RELEASE","NO_GO")
 sys.exit(2)
try:
 with TemporaryDirectory(prefix="p231170-buildcheck-") as temp:
  targets=[]
  for idx in (1,2):
   dest=Path(temp)/f"build{idx}"
   shutil.copytree(ROOT,dest)
   c=(dest/"firebase-v4-config.js").read_text("utf8")
   new=re.sub(pat,lambda m:m.group(1)+'"'+key+'";',c,count=1)
   (dest/"firebase-v4-config.js").write_text(new,"utf8")
   (dest/"index.html").write_text(hosted_index,"utf8")
   targets.append(dest)
  a,b=map(manifest_dict,targets)
  expected=set(original)
  coverage=(set(a)==set(b)==expected)
  repeatable=(a==b and coverage)
  unchanged=all((targets[0]/name).read_bytes()==contents
    for name,contents in original.items() if name not in ("index.html","firebase-v4-config.js"))
  syntax_ok=True;syntax_tests=0
  for name in JS:
   p=targets[0]/name
   process=subprocess.run(["node","--check",str(p)],capture_output=True,
     text=True,timeout=15)
   syntax_tests+=1
   if process.returncode!=0:syntax_ok=False
  emit("CANDIDATE_BUILD_COUNT",2)
  emit("COMPLETE_LOCAL_ASSET_INVENTORY",len(expected))
  emit("TWO_BUILD_INVENTORY_IDENTICAL","YES" if coverage else "NO")
  emit("TWO_BUILD_BYTE_CONTENT_IDENTICAL","YES" if repeatable else "NO")
  emit("UNRELATED_SOURCE_ASSETS_PRESERVED","YES" if unchanged else "NO")
  emit("JAVASCRIPT_SYNTAX_CHECKS",syntax_tests)
  emit("JAVASCRIPT_SYNTAX_ALL_PASS","YES" if syntax_ok else "NO")
  emit("INDEX_FROM_HOSTED_VERSION","YES" if (targets[0]/"index.html").read_text("utf8")==hosted_index else "NO")
  emit("STAGING_SITE_KEY_IN_BOTH_TEMP_BUILDS","YES" if all(key in (p/"firebase-v4-config.js").read_text("utf8") for p in targets) else "NO")
  passed=repeatable and unchanged and syntax_ok
  emit("CANDIDATE_BUILD_REGRESSION","PASS_TRANSIENT_ONLY" if passed else "FAIL")
 emit("TEMPORARY_BUILD_COPIES_AFTER_SCOPE","DISCARDED")
 emit("PUBLIC_SITE_KEY","VALUE_NOT_PRINTED")
 emit("FULL_PERSISTENT_ARTIFACT","NOT_CREATED")
 emit("BROWSER_RUNTIME_SMOKE","NOT_PERFORMED")
 emit("FIREBASE_CLI_PACKAGING_PARITY","NOT_VERIFIED")
 emit("CLOUD_CALLS","STATIC_PUBLIC_GET_ONLY")
 emit("CLOUD_WRITES","0")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(0 if passed else 3)
except Exception:
 emit("GATE","BLOCKED_CANDIDATE_BUILD_OR_SYNTAX")
 emit("DETAILS","REDACTED")
 emit("CLOUD_WRITES","0")
 emit("DEPLOY","NOT_PERFORMED")
 emit("RELEASE","NO_GO")
 sys.exit(2)
