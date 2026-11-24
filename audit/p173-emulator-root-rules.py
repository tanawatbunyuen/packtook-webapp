#!/usr/bin/env python3
"""P173 local Auth/Firestore emulator tests on CURRENT ROOT firestore.rules only.
No production credentials; no original backend import; no deployed reads/writes.
"""
import hashlib,json,os,secrets,signal,socket,subprocess,sys,time
from pathlib import Path
import urllib.request,urllib.error
ROOT=Path(__file__).resolve().parent.parent
AUDIT=Path(__file__).resolve().parent
PROJECT="demo-packtook-p173-root-rules"
PORTS=(19373,18373,14373,14374)
HOME=Path.home()/".packtook-demo-emulator-home"
SOURCE=ROOT/"firestore.rules"
EXPECTED="52e207280059e5700da77add9e4af45971c94557"
def blob(b):return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
def call(port,uri,body=None,token=None):
 url=f"http://127.0.0.1:{port}"+uri
 headers={"Accept":"application/json"}
 if body is not None:headers["Content-Type"]="application/json"
 if token:headers["Authorization"]="Bearer "+token
 req=urllib.request.Request(url,headers=headers,
    data=None if body is None else json.dumps(body).encode(),
    method="GET" if body is None else "POST")
 try:
  with urllib.request.urlopen(req,timeout=4) as response:
   status=response.status
   data=response.read(100000)
 except urllib.error.HTTPError as e:
  status=e.code;data=e.read(100000)
 except OSError:
  return 0,{}
 try:parsed=json.loads(data)
 except (ValueError,UnicodeError):parsed={}
 return status,parsed if isinstance(parsed,dict) else {}
def ready():
 status,r=call(14373,"/emulators")
 return status==200 and all(isinstance(r.get(k),dict) and r[k].get("port")==port
         for k,port in (("auth",19373),("firestore",18373)))
def diagnose_exit(log_path):
 """Return one safe category only; never expose raw emulator log lines."""
 try:
  data=log_path.read_text(encoding="utf-8",errors="replace")[-200000:].lower()
 except OSError:
  return "LOG_UNAVAILABLE"
 # Keep the output restricted to these known constant labels.
 if any(x in data for x in ("invalid rules", "rules parsing", "rules failed to compile",
                              "could not parse rules", "error compiling rules")):
  return "FIRESTORE_RULES_COMPILE"
 if any(x in data for x in ("file does not exist", "enoent", "no such file",
                              "could not find", "not found: ../firestore.rules")):
  return "CONFIG_OR_RULES_FILE_PATH"
 if any(x in data for x in ("permission denied", "eacces", "eperm")):
  return "LOCAL_FILESYSTEM_PERMISSION"
 if any(x in data for x in ("java not found", "java: command not found",
                              "unable to locate java", "could not find java")):
  return "JAVA_RUNTIME_UNAVAILABLE"
 if any(x in data for x in ("failed to download", "download failed",
                              "could not download", "unable to download")):
  return "EMULATOR_BINARY_UNAVAILABLE"
 if any(x in data for x in ("error: unknown option", "unknown option:",
                              "unrecognized option", "unknown argument")):
  return "CLI_OPTION_UNSUPPORTED"
 if any(x in data for x in ("eaddrinuse", "address already in use",
                              "port is already in use")):
  return "PORT_CONFLICT"
 if any(x in data for x in ("error: not in a firebase app directory",
                              "no firebase project", "invalid firebase.json")):
  return "FIREBASE_CONFIG"
 return "UNCLASSIFIED_REVIEW_PRIVATE_LOG"
def main():
 print("P173_MODE=LOCAL_ROOT_RULES_AUTH_FIRESTORE_EMULATOR")
 if blob(SOURCE.read_bytes())!=EXPECTED:
  print("P173_BLOCK=ROOT_SOURCE_DRIFT");return 1
 if not HOME.is_dir() or HOME.is_symlink():
  print("P173_BLOCK=PRIVATE_EMULATOR_HOME_MISSING");return 1
 for port in PORTS:
  with socket.socket() as sock:
   if sock.connect_ex(("127.0.0.1",port))==0:
    print("P173_BLOCK=PORT_IN_USE_"+str(port));return 1
 import shutil
 firebase=shutil.which("firebase")
 if not firebase:
  print("P173_BLOCK=FIREBASE_CLI_MISSING");return 1
 log=HOME/"p173-firestore-auth-emulator.log"
 fd=log.open("w")
 env={"PATH":os.environ.get("PATH",""),
      "HOME":str(HOME),"CI":"true","FIREBASE_SKIP_UPDATE_CHECK":"1",
      "GCLOUD_PROJECT":PROJECT,"GOOGLE_CLOUD_PROJECT":PROJECT,
      "FIREBASE_PROJECT_ID":PROJECT}
 proc=None
 try:
  proc=subprocess.Popen([firebase,"emulators:start","--project",PROJECT,
      "--only","auth,firestore","--config",str(AUDIT/"p173-emulator-root-rules.json"),
      "--non-interactive"],cwd=ROOT,env=env,
      stdout=fd,stderr=subprocess.STDOUT,start_new_session=True)
  for _ in range(60):
   if proc.poll() is not None:break
   if ready():break
   time.sleep(2)
  if not ready():
   if proc.poll() is not None:
    print("P173_EMULATOR_PROCESS=EXITED")
    print("P173_EMULATOR_EXIT_CODE_CLASS="+("ZERO" if proc.returncode==0 else "NONZERO"))
    fd.flush()
    print("P173_EMULATOR_EXIT_CATEGORY="+diagnose_exit(log))
   else:
    print("P173_EMULATOR_PROCESS=RUNNING_BUT_NOT_READY")
   hub_status,hub_data=call(14373,"/emulators")
   print("P173_HUB_HTTP_STATUS="+str(hub_status))
   if hub_status==200:
    for kind,expected_port in (("auth",19373),("firestore",18373)):
     entry=hub_data.get(kind)
     port=entry.get("port") if isinstance(entry,dict) else None
     print("P173_HUB_"+kind.upper()+"_PORT_MATCH="+str(port==expected_port).upper())
   print("P173_BLOCK=EMULATOR_NOT_READY");return 1
  print("P173_EMULATOR_LISTENERS=PASS")
  people=[]
  for i in (1,2):
   email="p173-"+secrets.token_hex(12)+"@example.invalid"
   password=secrets.token_urlsafe(24)
   status,x=call(19373,"/identitytoolkit.googleapis.com/v1/accounts:signUp?key=p173-demo-only",
      {"email":email,"password":password,"returnSecureToken":True})
   if status!=200 or not x.get("idToken") or not x.get("localId"):
    print("P173_BLOCK=LOCAL_AUTH_SIGNUP_FAILED");return 1
   people.append({"uid":x["localId"],"token":x["idToken"]})
  print("P173_DISPOSABLE_LOCAL_AUTH_USERS=2")
  count={"own":0,"cross":0,"anon":0,"write":0}
  for i in range(2):
   self_u=people[i];other_u=people[1-i]
   for suffix in ("","/recordings/p173-not-found","/audit/p173-not-found"):
    base=f"/v1/projects/{PROJECT}/databases/(default)/documents/accounts/"
    own_uri=base+self_u["uid"]+suffix
    other_uri=base+other_u["uid"]+suffix
    # no stored documents anywhere: owner should get not-found, nonowner denied
    status,_=call(18373,own_uri,token=self_u["token"])
    if status!=404:
     print("P173_BLOCK=OWNER_ABSENT_DOC_NOT_404");return 1
    count["own"]+=1
    status,_=call(18373,other_uri,token=self_u["token"])
    if status!=403:
     print("P173_BLOCK=CROSS_TENANT_NOT_DENIED");return 1
    count["cross"]+=1
    status,_=call(18373,own_uri)
    if status!=403:
     print("P173_BLOCK=ANON_READ_NOT_DENIED");return 1
    count["anon"]+=1
    # Firestore REST commit uses client auth token; all client writes must be denied.
    doc=f"projects/{PROJECT}/databases/(default)/documents/accounts/{self_u['uid']}{suffix}"
    status,_=call(18373,f"/v1/projects/{PROJECT}/databases/(default)/documents:commit",
      {"writes":[{"update":{"name":doc,"fields":{"p173Test":{"stringValue":"deny"}}}}]},
      token=self_u["token"])
    if status!=403:
     print("P173_BLOCK=CLIENT_WRITE_NOT_DENIED");return 1
    count["write"]+=1
  print("P173_OWNER_ABSENT_READS=6/6_PASS")
  print("P173_CROSS_TENANT_DENIED=6/6_PASS")
  print("P173_ANON_READ_DENIED=6/6_PASS")
  print("P173_CLIENT_WRITE_DENIED=6/6_PASS")
  print("P173_SUCCESSFUL_CLIENT_WRITES=0")
  print("P173_REAL_EMULATOR_CASES=24/24_PASS")
  print("P173_DEPLOYED_RULES_ATTESTED=FALSE")
  print("P173_DECISION=ROOT_RULES_CANDIDATE_EMULATOR_PASS_PRODUCTION_NO_GO")
  return 0
 finally:
  if proc and proc.poll() is None:
   try:os.killpg(proc.pid,signal.SIGTERM);proc.wait(timeout=15)
   except (ProcessLookupError,subprocess.TimeoutExpired):
    try:os.killpg(proc.pid,signal.SIGKILL)
    except ProcessLookupError:pass
    proc.wait(timeout=5)
  fd.close()
  print("P173_EMULATORS_STOPPED=TRUE")
  print("P173_CLOUD_CALLS=0 P173_DEPLOYS=0")
if __name__=="__main__":
 try:sys.exit(main())
 except Exception:
  print("P173_BLOCK=LOCAL_RUN_INCOMPLETE")
  print("P173_DECISION=NO_GO_EMULATOR_VERIFICATION")
  sys.exit(1)
