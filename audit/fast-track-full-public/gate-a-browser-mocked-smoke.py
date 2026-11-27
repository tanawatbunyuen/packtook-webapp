#!/usr/bin/env python3
"""Extract exact immutable review candidate to disposable localhost server; run Playwright.
No writes to repo or cloud. Exits 4 when Playwright/Chromium unavailable.
Never prints candidate Config, public site key, source or browser payloads.
"""
import hashlib,json,os,pathlib,subprocess,sys,tempfile,threading
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from zipfile import ZipFile
from io import BytesIO
ROOT=pathlib.Path("/tmp/packtook-fast-track-gate-a-review")
ZIP=ROOT/"gate-a-staging-REVIEW-NO-DEPLOY.zip"
META=ROOT/"gate-a-staging-REVIEW-NO-DEPLOY.manifest.json"
EXPECTED="ab61130b84609ef96583766f72d891bc44b1a4e3fa016cf9ea137347c18ba0f2"
JS=pathlib.Path("audit/fast-track-full-public/gate-a-browser-mocked-smoke.cjs").resolve()
def out(k,v):print("PACKTOOK_"+k+"="+str(v),flush=True)
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):self.send_error(405)
 def do_PUT(self):self.send_error(405)
 def do_DELETE(self):self.send_error(405)
out("CHECK","GATE_A3_PINNED_ARTIFACT_BROWSER_MOCK_SMOKE")
try:
 content=ZIP.read_bytes()
 if hashlib.sha256(content).hexdigest()!=EXPECTED:raise ValueError("archive pin")
 m=json.loads(META.read_text("utf8"))
 if m["sha256_zip"]!=EXPECTED or m["classification"]!="REVIEW_CANDIDATE_NOT_AUTHORIZED_FOR_DEPLOY":
  raise ValueError("manifest mismatch")
 p=subprocess.run(["node","-e","try{require.resolve('playwright');process.exit(0)}catch{process.exit(1)}"],
   capture_output=True,timeout=8)
 if p.returncode:
  out("GATE_A3","BLOCKED_PLAYWRIGHT_NOT_INSTALLED")
  out("BROWSER_EXECUTION","NOT_PERFORMED")
  out("CLOUD_WRITES","0");out("FULL_PUBLIC","NO_GO")
  sys.exit(4)
 with tempfile.TemporaryDirectory(prefix="packtook-gate-a3-") as tmp:
  path=pathlib.Path(tmp)
  with ZipFile(BytesIO(content),"r") as z:
   for item in z.infolist():
    name=item.filename
    if name.startswith("/") or any(x in ("",".","..") for x in name.split("/")) or not name:
     raise ValueError("unsafe zip entry")
    if item.is_dir() or item.file_size>25000000:raise ValueError("unsafe ZIP member")
    target=path/name;target.parent.mkdir(parents=True,exist_ok=True)
    target.write_bytes(z.read(item))
  server=ThreadingHTTPServer(("127.0.0.1",0),lambda *args,**kwargs:Handler(*args,directory=tmp,**kwargs))
  thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:
   env={**os.environ,"PACKTOOK_CANDIDATE_ORIGIN":f"http://127.0.0.1:{server.server_port}"}
   result=subprocess.run(["node",str(JS)],cwd=str(pathlib.Path.cwd()),env=env,
    timeout=45)
  finally:
   server.shutdown();server.server_close();thread.join(timeout=5)
  out("BROWSER_GATE_EXIT",result.returncode)
  out("LOCAL_ARTIFACT_DISPOSAL","DONE")
  out("FULL_PUBLIC","NO_GO")
  sys.exit(result.returncode)
except subprocess.TimeoutExpired:
 out("GATE_A3","BLOCKED_TEST_TIMEOUT")
except Exception:
 out("GATE_A3","BLOCKED_LOCAL_SETUP_OR_BROWSER")
out("DEPLOY","NOT_PERFORMED")
out("CLOUD_WRITES","0")
out("FULL_PUBLIC","NO_GO")
sys.exit(2)
