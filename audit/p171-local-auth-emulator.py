#!/usr/bin/env python3
"""P171 starts only loopback Auth Emulator. Never access real Firebase project."""
import hashlib,json,os
from pathlib import Path
import shutil,signal,socket,subprocess,sys,tempfile,time,urllib.request,urllib.error
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/"functions/index.js"
PROJECT="demo-packtook-p171-admin-token"
HOST="127.0.0.1"
PORTS={"auth":19371,"hub":14371,"logging":14372}
HOME=Path.home()/".packtook-demo-emulator-home"
EXPECTED="92262ea2fbbb941188937d72f0eea74a735d2bf3"
def git_blob(b):return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
def ready():
 try:
  with urllib.request.urlopen("http://127.0.0.1:14371/emulators",timeout=2) as r:
   obj=json.loads(r.read(16384))
  return isinstance(obj.get("auth"),dict) and obj["auth"].get("port")==19371 and "functions" not in obj and "firestore" not in obj
 except (OSError,ValueError,KeyError):return False
def main():
 print("P171_MODE=ISOLATED_LOCAL_ADMIN_TOKEN_VERIFICATION")
 if git_blob(SOURCE.read_bytes())!=EXPECTED:
  print("P171_BLOCK=SOURCE_DRIFT");return 1
 if not HOME.is_dir() or HOME.is_symlink() or not shutil.which("firebase") or not shutil.which("node"):
  print("P171_BLOCK=ISOLATED_RUNTIME_DEPENDENCY_MISSING");return 1
 p168=Path.home()/"packtook-p168"/"functions"
 if not (p168/"node_modules").is_dir() or git_blob((p168/"index.js").read_bytes())!=EXPECTED:
  print("P171_BLOCK=PINNED_P168_SDK_MISSING");return 1
 for port in PORTS.values():
  with socket.socket() as s:
   if s.connect_ex((HOST,port))==0:
    print("P171_BLOCK=LOCAL_PORT_IN_USE_"+str(port));return 1
 old=os.umask(0o077)
 try:tmp=Path(tempfile.mkdtemp(prefix="p171-auth-",dir=HOME))
 finally:os.umask(old)
 config={"emulators":{
  "auth":{"host":HOST,"port":19371},
  "hub":{"host":HOST,"port":14371},
  "logging":{"host":HOST,"port":14372},
  "ui":{"enabled":False}}}
 (tmp/"firebase.json").write_text(json.dumps(config))
 env={"PATH":os.environ.get("PATH",""),"HOME":str(Path.home()),
      "CI":"true","FIREBASE_SKIP_UPDATE_CHECK":"1",
      "GCLOUD_PROJECT":PROJECT,"GOOGLE_CLOUD_PROJECT":PROJECT,
      "FIREBASE_PROJECT_ID":PROJECT,
      "FIREBASE_AUTH_EMULATOR_HOST":"127.0.0.1:19371"}
 log=HOME/"p171-auth-emulator.log"
 old=os.umask(0o077)
 try:fd=log.open("w")
 finally:os.umask(old)
 child=None
 try:
  child=subprocess.Popen([shutil.which("firebase"),"emulators:start",
        "--project",PROJECT,"--only","auth","--config",str(tmp/"firebase.json"),
        "--non-interactive"],cwd=tmp,env=env,stdout=fd,stderr=subprocess.STDOUT,
        start_new_session=True)
  fd.close()
  for _ in range(45):
   if child.poll() is not None:break
   if ready():break
   time.sleep(2)
  else:pass
  if not ready():
   print("P171_BLOCK=AUTH_EMULATOR_NOT_READY");return 1
  print("P171_AUTH_EMULATOR_READY=PASS")
  out=subprocess.run(["node",str(ROOT/"audit/p171-admin-verify.js")],
                     cwd=ROOT,env=env,timeout=90,check=False)
  return out.returncode
 except (OSError,subprocess.TimeoutExpired):
  print("P171_BLOCK=ISOLATED_PROCESS_ERROR");return 1
 finally:
  if child and child.poll() is None:
   try:
    os.killpg(child.pid,signal.SIGTERM)
    child.wait(timeout=15)
   except (ProcessLookupError,subprocess.TimeoutExpired):
    try:os.killpg(child.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    child.wait(timeout=5)
  try:fd.close()
  except OSError:pass
  shutil.rmtree(tmp,ignore_errors=True)
  print("P171_AUTH_EMULATOR_STOPPED=TRUE")
  print("P171_TEMP_RUNTIME_REMOVED=TRUE")
  print("P171_CLOUD_CALLS=0 P171_DEPLOYS=0 P171_OWNER_SOURCE_IMPORTS=0")
if __name__=="__main__":
 try:sys.exit(main())
 except Exception:
  print("P171_BLOCK=PREPARATION_FAILED")
  print("P171_DECISION=NO_GO_LOCAL_TEST_INCOMPLETE")
  sys.exit(1)
