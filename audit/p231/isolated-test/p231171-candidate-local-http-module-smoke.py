#!/usr/bin/env python3
"""P231.171 — local candidate HTTP delivery and JS module-import graph smoke.
Test only 127.0.0.1 temporary static server. Public GET of 3 staging static
assets is solely for candidate construction. Never execute browser modules.
No Firebase Auth, App Check, Functions, IAM, Firestore or deployment.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.request import Request,urlopen
from urllib.parse import quote
from threading import Thread
from html.parser import HTMLParser
import functools,json,os,re,shutil,sys

ROOT=Path("firebase-staging")
BASE="https://packtook-staging.web.app/"
JS=("firebase-packing-bridge.js","video-history-db.js",
    "video-stream-writer.js","performance-monitor.js","app.js")
EXPECTED_EXT={
 "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js",
 "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js",
 "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js",
 "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-check.js"}
def out(k,v):print("P231_"+k+"="+str(v),flush=True)
def fetch_public(name):
 req=Request(BASE+name,method="GET",headers={
 "Cache-Control":"no-cache","User-Agent":"PACKTOOK-P231171-PublicStaticAudit"})
 with urlopen(req,timeout=18) as r:
  if r.status!=200:raise ValueError("public asset status")
  data=r.read(2000001)
  if len(data)>2000000:raise ValueError("asset size")
  return data.decode("utf8")
class Index(HTMLParser):
 def __init__(self):super().__init__();self.refs=[]
 def handle_starttag(self,tag,attrs):
  if tag=="script":
   src=dict(attrs).get("src")
   if src:self.refs.append(src)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,format,*args):pass
 def do_POST(self):
  self.send_error(405)
 def do_PUT(self):
  self.send_error(405)
 def do_DELETE(self):
  self.send_error(405)
def norm(text):
 pat=re.compile(r'(<script\b[^>]*\bsrc\s*=\s*)(["\x27])([^"\x27]+)\2',re.I)
 def f(m):
  p,q,u=m.groups()
  return p+q+u.split("?")[0]+"?v=MASKED"+q if re.fullmatch(
    r'[A-Za-z0-9._/-]+\.js\?v=[A-Za-z0-9._-]+',u) else m.group(0)
 return pat.sub(f,text)
out("CHECK","TRANSIENT_STAGING_CANDIDATE_LOCAL_HTTP_MODULE_GRAPH")
try:
 hosting=json.loads(Path("firebase.json").read_text("utf8"))["hosting"]
 if hosting.get("public")!="firebase-staging":raise ValueError("scope")
 hosted_index=fetch_public("index.html")
 hosted_bridge=fetch_public("firebase-packing-bridge.js")
 hosted_cfg=fetch_public("firebase-v4-config.js")
 local_index=(ROOT/"index.html").read_text("utf8")
 if norm(local_index)!=norm(hosted_index):raise ValueError("index drift")
 if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',hosted_cfg):
  raise ValueError("wrong project")
 match=re.search(r'new\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)',hosted_bridge)
 if not match or not re.fullmatch(r"[A-Za-z0-9_-]{20,300}",match.group(2)):
  raise ValueError("public key shape")
 key=match.group(2)
except Exception:
 out("GATE","BLOCKED_PUBLIC_SOURCE_PRECONDITIONS")
 out("RELEASE","NO_GO")
 sys.exit(2)

try:
 with TemporaryDirectory(prefix="p231171-http-smoke-") as tmp:
  dest=Path(tmp)/"hosting"
  shutil.copytree(ROOT,dest)
  config_path=dest/"firebase-v4-config.js"
  config=config_path.read_text("utf8")
  expression=r'(export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*)(["\x27])\2\s*;'
  if len(list(re.finditer(expression,config)))!=1:raise ValueError("config shape")
  config_path.write_text(re.sub(expression,lambda m:m.group(1)+'"'+key+'";',config,count=1),"utf8")
  (dest/"index.html").write_text(hosted_index,"utf8")
  parsed=Index();parsed.feed(hosted_index)
  refs=[]
  for src in parsed.refs:
   m=re.fullmatch(r"([a-zA-Z0-9_-]+\.js)\?v=[a-zA-Z0-9._-]+",src)
   if not m:raise ValueError("unexpected script ref")
   refs.append(m.group(1))
  if len(refs)!=5 or set(refs)!=set(JS):raise ValueError("script manifest")
  # Compile an import inventory without executing JS. Enforce explicit Firebase CDN allowlist.
  bridge=(dest/"firebase-packing-bridge.js").read_text("utf8")
  import_urls=re.findall(r'\bfrom\s*["\x27]([^"\x27]+)["\x27]',bridge)
  expected_relative="./firebase-v4-config.js"
  imports_ok=bool(import_urls) and set(import_urls)==EXPECTED_EXT|{expected_relative}
  guarded=all(s in bridge for s in ("appCheckReady","protectedApi(\"usageStatus\")","protectedApi(\"recordingStatus\")"))
  server=ThreadingHTTPServer(("127.0.0.1",0),
      functools.partial(Handler,directory=str(dest)))
  thread=Thread(target=server.serve_forever,daemon=True)
  thread.start()
  success=0
  try:
   for path in sorted(p.relative_to(dest).as_posix() for p in dest.rglob("*") if p.is_file()):
    if "/." in "/"+path or "node_modules" in path.split("/") or path=="firebase.json":continue
    request=Request("http://127.0.0.1:"+str(server.server_port)+"/"+quote(path,safe="/"),
       method="GET")
    with urlopen(request,timeout=5) as response:
     actual=response.read(25000001)
     if response.status!=200 or actual!=(dest/path).read_bytes():raise ValueError("http bytes mismatch")
    success+=1
  finally:
   server.shutdown();server.server_close();thread.join(timeout=5)
  out("CANDIDATE_HTTP_SERVER","LOOPBACK_ONLY")
  out("HOSTING_FILES_HTTP_GET_200_EXACT_BYTES",success)
  out("INDEX_VERSIONED_JS_REFS",len(refs))
  out("FIREBASE_SDK_IMPORTS_ALLOWLIST","PASS" if imports_ok else "BLOCKED")
  out("STATUS_FAIL_CLOSED_SOURCE","PRESERVED" if guarded else "MISSING")
  out("EXTERNAL_CDN_MODULE_FETCH","NOT_PERFORMED")
  out("BROWSER_JS_EXECUTION","NOT_PERFORMED")
  out("BROWSER_RUNTIME","NOT_VERIFIED")
  passed=success>=7 and imports_ok and guarded
  out("LOCAL_HTTP_MODULE_GRAPH_GATE","PASS_NO_BROWSER_EXECUTION" if passed else "BLOCKED")
 out("TEMPORARY_BUILD","DISCARDED")
 out("PUBLIC_SITE_KEY","NOT_PRINTED")
 out("AUTH_OR_APPCHECK_TOKEN_REQUESTS","0")
 out("FUNCTIONS_CALLS","0")
 out("CLOUD_REQUESTS","THREE_PUBLIC_STATIC_GET_ONLY")
 out("CLOUD_WRITES","0")
 out("DEPLOY","NOT_PERFORMED")
 out("RELEASE","NO_GO")
 sys.exit(0 if passed else 3)
except Exception:
 out("GATE","BLOCKED_LOCAL_HTTP_OR_ASSET_VALIDATION")
 out("ERROR_DETAIL","REDACTED")
 out("CLOUD_WRITES","0")
 out("DEPLOY","NOT_PERFORMED")
 out("RELEASE","NO_GO")
 sys.exit(2)
