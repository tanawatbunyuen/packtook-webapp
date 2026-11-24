#!/usr/bin/env python3
"""P173 isolated Auth-only startup differential probe (no test accounts).
Runs a locally configured, disposable demo Auth Emulator. Never contacts
production or staging. Emits only safe constant classifications/port numbers.
"""
import json,os,signal,socket,subprocess,sys,tempfile,time,shutil
from pathlib import Path
import urllib.request,urllib.error
ROOT=Path(__file__).resolve().parent.parent
HOME=Path.home()/".packtook-demo-emulator-home"
PROJECT="demo-packtook-p173-auth-only"
AUTH=19375
HUB=14375
LOGGING=14376
def hub_status():
 try:
  with urllib.request.urlopen(f"http://127.0.0.1:{HUB}/emulators",timeout=2) as rsp:
   if rsp.status!=200:return "HTTP_NON_200",None
   data=json.loads(rsp.read(16000))
  entry=data.get("auth") if isinstance(data,dict) else None
  if not isinstance(entry,dict):return "AUTH_NOT_REGISTERED",None
  port=entry.get("port")
  if type(port) is not int or not 1<=port<=65535:return "AUTH_PORT_INVALID",None
  return "AUTH_REGISTERED",port
 except (OSError,ValueError):
  return "HUB_UNREACHABLE",None
def tcp_open(port):
 try:
  with socket.socket() as s:
   s.settimeout(1)
   return s.connect_ex(("127.0.0.1",port))==0
 except OSError:return False
def log_category(p):
 try:data=p.read_text(encoding="utf-8",errors="replace").lower()[-100000:]
 except OSError:return "PRIVATE_LOG_UNAVAILABLE"
 if "eaddrinuse" in data or "address already in use" in data:return "PORT_CONFLICT"
 if "permission denied" in data or "eacces" in data:return "LOCAL_PERMISSION"
 if "invalid firebase.json" in data or "unknown option" in data:return "CONFIG_OR_CLI_OPTION"
 if "error" in data:return "ERROR_PRESENT_REVIEW_LOCALLY"
 if "auth" in data:return "AUTH_MENTIONED_NO_CLASSIFIABLE_ERROR"
 return "NO_RECOGNIZED_AUTH_STATUS"
def main():
 print("P173_DIFFERENTIAL_MODE=AUTH_ONLY_NO_ACCOUNTS")
 if not HOME.is_dir() or HOME.is_symlink():
  print("P173_AUTH_ONLY_BLOCK=PRIVATE_LOG_HOME_MISSING");return 1
 firebase=shutil.which("firebase")
 if not firebase:
  print("P173_AUTH_ONLY_BLOCK=FIREBASE_CLI_MISSING");return 1
 for port in (AUTH,HUB,LOGGING):
  if tcp_open(port):
   print("P173_AUTH_ONLY_BLOCK=LOCAL_PORT_OCCUPIED");return 1
 cfg={"emulators":{
  "auth":{"host":"127.0.0.1","port":AUTH},
  "hub":{"host":"127.0.0.1","port":HUB},
  "logging":{"host":"127.0.0.1","port":LOGGING},
  "ui":{"enabled":False}}}
 tmp=None
 proc=None
 fd=None
 try:
  with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8",prefix=".p173-auth-only-",
     suffix=".json",dir=ROOT,delete=False) as out:
   tmp=Path(out.name)
   os.chmod(tmp,0o600)
   json.dump(cfg,out)
  log=HOME/"p173-auth-only-probe.log"
  fd=log.open("w")
  env={"PATH":os.environ.get("PATH",""),"HOME":str(Path.home()),
      "CI":"true","FIREBASE_SKIP_UPDATE_CHECK":"1",
      "GCLOUD_PROJECT":PROJECT,"GOOGLE_CLOUD_PROJECT":PROJECT,
      "FIREBASE_PROJECT_ID":PROJECT}
  print("P173_AUTH_ONLY_CONFIG_AUTH_ENABLED=TRUE")
  proc=subprocess.Popen([firebase,"emulators:start","--project",PROJECT,
      "--only","auth","--config",str(tmp),"--non-interactive"],
      cwd=ROOT,env=env,stdout=fd,stderr=subprocess.STDOUT,start_new_session=True)
  category,port="HUB_UNREACHABLE",None
  for _ in range(35):
   if proc.poll() is not None:break
   category,port=hub_status()
   if category=="AUTH_REGISTERED":break
   time.sleep(2)
  category,port=hub_status()
  print("P173_AUTH_ONLY_HUB_CLASS="+category)
  print("P173_AUTH_ONLY_REGISTERED_PORT="+str(port if port is not None else "MISSING"))
  print("P173_AUTH_ONLY_EXPECTED_PORT_MATCH="+str(port==AUTH).upper())
  print("P173_AUTH_ONLY_TCP_OPEN="+str(tcp_open(AUTH)).upper())
  print("P173_AUTH_ONLY_PROCESS_CLASS="+("RUNNING" if proc.poll() is None else "EXITED"))
  if port==AUTH and tcp_open(AUTH):
   print("P173_AUTH_ONLY_DIFFERENTIAL=PASS")
   print("P173_AUTH_ONLY_DECISION=COMPARE_WITH_DUAL_EMULATOR_STARTUP")
   return 0
  fd.flush()
  print("P173_AUTH_ONLY_LOG_CLASS="+log_category(log))
  print("P173_AUTH_ONLY_DIFFERENTIAL=INCOMPLETE")
  print("P173_AUTH_ONLY_DECISION=NO_GO")
  return 1
 finally:
  if proc and proc.poll() is None:
   try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=15)
   except (ProcessLookupError,subprocess.TimeoutExpired):
    try:os.killpg(proc.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    proc.wait(timeout=5)
  if fd:fd.close()
  if tmp:tmp.unlink(missing_ok=True)
  print("P173_AUTH_ONLY_EMULATOR_STOPPED=TRUE")
  print("P173_AUTH_ONLY_TEMP_CONFIG_REMOVED=TRUE")
  print("P173_AUTH_ONLY_CLOUD_CALLS=0 P173_AUTH_ONLY_DEPLOYS=0")
if __name__=="__main__":
 try:sys.exit(main())
 except Exception:
  print("P173_AUTH_ONLY_BLOCK=LOCAL_PROBE_FAILED")
  print("P173_AUTH_ONLY_DECISION=NO_GO")
  sys.exit(1)
