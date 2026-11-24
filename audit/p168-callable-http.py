#!/usr/bin/env python3
"""P168 demo-only REAL Firebase Callable HTTP emulator verification.
No production/staging network or deploy. All identities are synthetic Auth Emulator users.
No original functions/index.js module import, no recovered Owner code.
"""
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "functions/index.js"
PACKAGE = ROOT / "functions/package.json"
HOME = Path.home() / ".packtook-demo-emulator-home"
EXPECTED = "92262ea2fbbb941188937d72f0eea74a735d2bf3"
PROJECT = "demo-packtook-owner-http-p168"
HOST = "127.0.0.1"
PORTS = {"hub":14600,"auth":19299,"functions":15081,"logging":14610}
FUNCS = ("ownerAnalyticsSummary","ownerAnalyticsCustomers")
REGION = "asia-southeast1"

def blob(data):
    return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()

def fragment(source,name):
    needle="function "+name+"(req){"
    start=source.find(needle)
    if start<0 or source.find(needle,start+1)>=0:
        raise ValueError("fragment_missing_or_duplicate")
    depth=0
    for i in range(start+len(needle)-1,len(source)):
        if source[i]=="{": depth+=1
        if source[i]=="}":
            depth-=1
            if depth==0:return source[start:i+1]
    raise ValueError("fragment_unterminated")

def reviewed(source_bytes):
    if blob(source_bytes)!=EXPECTED:
        raise ValueError("source_hash_drift")
    source=source_bytes.decode("utf8")
    a=fragment(source,"uid")
    b=fragment(source,"requirePlatformOwner")
    marker="exports.ownerAnalyticsSummary=onCall(ownerOptions,async req=>{"
    start=source.find(marker)
    if start<0 or source.find(marker,start+1)>=0:
        raise ValueError("summary_handler_missing")
    suffix=source[start:]
    if suffix.count("exports.ownerAnalyticsCustomers=onCall(ownerOptions,async req=>{")!=1:
        raise ValueError("customer_handler_missing")
    if suffix.count("=onCall(")!=2 or "=onRequest(" in suffix:
        raise ValueError("extra_handler_in_suffix")
    for name in FUNCS:
        mark="exports."+name+"=onCall(ownerOptions,async req=>{"
        pos=suffix.find(mark)
        if pos<0 or not suffix[pos+len(mark):].lstrip().startswith("requirePlatformOwner(req);"):
            raise ValueError("guard_not_first")
    if "req.auth.token.packtookPlatformOwner!==true" not in b:
        raise ValueError("claim_guard_mismatch")
    for name in ("ownerGrantVideoCredits","ownerUpdateCustomerExpiry",
                 "ownerGetCustomerManageState","ownerGetCustomerAdjustmentHistory"):
        if "exports."+name+"=" in source:
            raise ValueError("recovered_owner_handler_present")
    return a,b,suffix

def generated_index(parts, trace_path):
    a,b,suffix=parts
    # Only source-verified, exact helper + handler snippets; hardwired empty mock datastore.
    prelude = r'''
"use strict";
const fs=require("node:fs");
const {createRequire}=require("node:module");
const sdkRequire=createRequire(__PACKTOOK_PACKAGE__);
const {onCall,HttpsError}=sdkRequire("firebase-functions/v2/https");
const exportsRef=exports;
const TRACE=__TRACE_PATH__;
function dbEvent(){fs.appendFileSync(TRACE,"READ\n",{encoding:"utf8",mode:0o600});}
const empty={empty:true,size:0,docs:[]};
const q={
 orderBy(){return this;},limit(){return this;},startAfter(){return this;},
 async get(){dbEvent();return empty;}
};
const db={collection(){dbEvent();return q;}};
const admin={
 firestore:{FieldPath:{documentId(){return "__name__";}}},
 auth(){return {async getUsers(){dbEvent();return {users:[]};}};}
};
const ownerOptions={region:"asia-southeast1",enforceAppCheck:false};
const pricesTHB={Free:0,Starter:199,Basic:299,Growth:599,Business:1290,Pro:1990};
const OWNER_MAX_ACCOUNTS=1200,OWNER_BATCH=100,OWNER_CONCURRENCY=12;
const limits={Free:20,Starter:50,Pro:null};
function data(req){return req.data&&typeof req.data==="object"?req.data:{}}
function ownerMonthTH(timestamp){return new Date(timestamp+7*3600000).toISOString().slice(0,7)}
function ownerTimestamp(value){if(!value)return null;
 if(typeof value.toMillis==="function")return value.toMillis();
 if(typeof value==="number"&&Number.isFinite(value))return value;
 if(typeof value==="string"){const ms=Date.parse(value);return Number.isFinite(ms)?ms:null}
 return null;
}
function subscriptionState(){return "free"}
function creditAvailable(){return 20}
function pendingReservations(){return 0}
'''
    prelude=prelude.replace("__PACKTOOK_PACKAGE__",json.dumps(str(PACKAGE)))
    prelude=prelude.replace("__TRACE_PATH__",json.dumps(str(trace_path)))
    # Instrument only generated, local test wrapper at the handler entry boundary.
    # Do not alter the pinned source file or grant any additional privilege.
    for name in FUNCS:
        entry="exports."+name+"=onCall(ownerOptions,async req=>{"
        if suffix.count(entry)!=1:
            raise ValueError("handler_entry_drift")
        suffix=suffix.replace(entry,entry+'dbEventMarker();',1)
    prelude=prelude.replace("const empty={empty:true,size:0,docs:[]};",
        'function dbEventMarker(){fs.appendFileSync(TRACE,"HANDLER\\n",{encoding:"utf8",mode:0o600});}' + "\n" +
        'const empty={empty:true,size:0,docs:[]};')
    return prelude+"\n"+a+"\n"+b+"\n"+suffix

def request(port,path,payload=None,token=None):
    headers={"Accept":"application/json"}
    if payload is not None: headers["Content-Type"]="application/json"
    if token: headers["Authorization"]="Bearer "+token
    req=urllib.request.Request(
       f"http://{HOST}:{port}{path}",method="POST" if payload is not None else "GET",
       headers=headers,data=json.dumps(payload).encode() if payload is not None else None)
    try:
        with urllib.request.urlopen(req,timeout=5) as resp:
            code=resp.status
            raw=resp.read(32768)
    except urllib.error.HTTPError as ex:
        code=ex.code
        raw=ex.read(32768)
    except (urllib.error.URLError,TimeoutError,OSError):
        return 0,{}
    try: parsed=json.loads(raw)
    except (ValueError,UnicodeDecodeError):parsed={}
    return code,parsed if isinstance(parsed,dict) else {}

def status(function,token=None,payload=None):
    return request(PORTS["functions"],f"/{PROJECT}/{REGION}/{function}",
                   {"data":payload if payload is not None else {}},token)

def npm_preflight():
    code = r'''
const {createRequire}=require("module");
const r=createRequire(process.argv[1]);
for(const m of ["firebase-functions/v2/https","firebase-admin"]){
  try{r.resolve(m)}catch{process.exit(12)}
}
'''
    p=subprocess.run(["node","-e",code,str(PACKAGE)],
       capture_output=True,text=True,timeout=10)
    return p.returncode==0

def admin_action(action,records, log):
    # Node admin SDK redirected to the LOCAL Auth emulator only.
    script=r'''
const {createRequire}=require("module");
const fs=require("fs");
const r=createRequire(process.argv[1]),admin=r("firebase-admin");
admin.initializeApp({projectId:process.env.GCLOUD_PROJECT});
(async()=>{
 const records=JSON.parse(fs.readFileSync(0,"utf8"));
 if(process.argv[2]==="create"){
   for(const x of records){
    try{
     await admin.auth().createUser({uid:x.uid,email:x.email,
       password:x.password,emailVerified:x.verified});
     if(x.claims)await admin.auth().setCustomUserClaims(x.uid,x.claims);
    }catch(e){try{await admin.auth().deleteUser(x.uid)}catch(_){/*best-effort rollback*/}throw e;}
   }
 }else if(process.argv[2]==="delete"){
   for(const x of records)await admin.auth().deleteUser(x.uid);
 }else throw Error("unknown_action");
})().then(()=>process.stdout.write("PASS\n"))
 .catch(()=>{process.stdout.write("FAIL\n");process.exitCode=1});
'''
    try:
        p=subprocess.run(["node","-e",script,str(PACKAGE),action],
           input=json.dumps(records),capture_output=True,text=True,timeout=35,
           env={"HOME":str(HOME),"PATH":os.environ.get("PATH",""),
             "NODE_ENV":"test","GCLOUD_PROJECT":PROJECT,
             "GOOGLE_CLOUD_PROJECT":PROJECT,
             "FIREBASE_AUTH_EMULATOR_HOST":f"{HOST}:{PORTS['auth']}"})
        return p.returncode==0 and p.stdout.strip()=="PASS"
    except (OSError,subprocess.TimeoutExpired):
        return False

def auth_login(user):
    payload={"email":user["email"],"password":user["password"],
             "returnSecureToken":True}
    code,obj=request(PORTS["auth"],
       "/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=p168-demo-only",
       payload)
    return obj.get("idToken") if code==200 and isinstance(obj.get("idToken"),str) else None

def reg_ready():
    code,data=request(PORTS["hub"],"/emulators")
    return (code==200 and all(isinstance(data.get(name),dict)
            and data[name].get("port")==PORTS[name]
            and data[name].get("host")==HOST
            for name in ("auth","functions","hub"))
            and "firestore" not in data)

def trace_count(path):
    return path.read_text().count("READ\n") if path.exists() else 0

def handler_entry_count(path):
    return path.read_text().count("HANDLER\n") if path.exists() else 0

def verify(trace):
    users=[]
    for label,verified,claims in [
       ("UNVERIFIED",False,{"packtookPlatformOwner":True}),
       ("CUSTOMER_ADMIN",True,{"admin":True}),
       ("MISSING_CLAIM",True,None),
       ("FALSE_CLAIM",True,{"packtookPlatformOwner":False}),
       ("STRING_CLAIM",True,{"packtookPlatformOwner":"true"}),
       ("OWNER",True,{"packtookPlatformOwner":True})]:
        users.append({"label":label,"uid":"p168-"+secrets.token_hex(12),
          "email":"p168-"+secrets.token_hex(12)+"@example.invalid",
          "password":secrets.token_urlsafe(24),"verified":verified,"claims":claims})
    ok=True
    created=[]
    try:
        # Create users one by one so partial failures remain trackable.
        for u in users:
            good=admin_action("create",[u],None)
            print("P168_SYNTHETIC_"+u["label"]+"_CREATED="+("PASS" if good else "FAIL"))
            if not good:
                ok=False
                break
            created.append(u)
            u["token"]=auth_login(u)
            good=bool(u["token"])
            print("P168_SYNTHETIC_"+u["label"]+"_LOGIN="+("PASS" if good else "FAIL"))
            if not good:
                ok=False
                break
        if len(created)==len(users) and ok:
            for name in FUNCS:
                scenarios=[("SIGNED_OUT",None,"UNAUTHENTICATED"),
                           ("INVALID_TOKEN","invalid-p168-demo-token","UNAUTHENTICATED")]
                scenarios += [(u["label"],u["token"],"PERMISSION_DENIED")
                              for u in users if u["label"]!="OWNER"]
                scenarios.append(("FORGED_PAYLOAD",next(
                     u["token"] for u in users if u["label"]=="MISSING_CLAIM"),
                     "PERMISSION_DENIED"))
                for label,token,wanted in scenarios:
                    before=trace_count(trace)
                    entry_before=handler_entry_count(trace)
                    code,data=status(name,token,{"packtookPlatformOwner":True,"role":"owner"})
                    after=trace_count(trace)
                    entry_after=handler_entry_count(trace)
                    observed=data.get("error",{}).get("status")
                    good=(observed==wanted and after==before and code in (401,403))
                    if label=="INVALID_TOKEN":
                        # Strictly preserve protocol conformance gate (401/UNAUTHENTICATED).
                        # 403/PERMISSION_DENIED + zero reads is a security denial, not a protocol PASS.
                        secure_denial=(code in (401,403) and observed in (
                            "UNAUTHENTICATED","PERMISSION_DENIED") and after==before)
                        protocol_conformant=(code==401 and observed=="UNAUTHENTICATED")
                        print(f"P168_{name.upper()}_INVALID_TOKEN_SECURITY_DENIED="+
                              ("PASS" if secure_denial else "FAIL"))
                        print(f"P168_{name.upper()}_INVALID_TOKEN_PROTOCOL_CONFORMANT="+
                              ("PASS" if protocol_conformant else "FAIL"))
                        print(f"P168_{name.upper()}_INVALID_TOKEN_HANDLER_ENTERED="+
                              ("TRUE" if entry_after>entry_before else "FALSE"))
                        # Only fixed, non-sensitive classifiers: NEVER print token/body/log.
                        safe_status=(observed if observed in (
                            "UNAUTHENTICATED","PERMISSION_DENIED","INVALID_ARGUMENT",
                            "INTERNAL","UNKNOWN","NOT_FOUND") else "OTHER_OR_MISSING")
                        safe_http=(str(code) if code in (0,200,400,401,403,404,500,503) else "OTHER")
                        print(f"P168_{name.upper()}_INVALID_TOKEN_HTTP="+safe_http)
                        print(f"P168_{name.upper()}_INVALID_TOKEN_STATUS="+safe_status)
                        print(f"P168_{name.upper()}_INVALID_TOKEN_DB_READS_UNCHANGED="+
                              ("TRUE" if after==before else "FALSE"))
                    print(f"P168_{name.upper()}_{label}="+("PASS" if good else "FAIL"))
                    ok=ok and good
                before=trace_count(trace)
                owner=next(u["token"] for u in users if u["label"]=="OWNER")
                code,data=status(name,owner)
                after=trace_count(trace)
                result=data.get("result",{})
                good=(code==200 and isinstance(result,dict) and after>before and
                      (result.get("totals",{}).get("customers")==0 if name=="ownerAnalyticsSummary"
                       else result.get("customers")==[]))
                print(f"P168_{name.upper()}_OWNER_EMPTY_MOCK="+("PASS" if good else "FAIL"))
                ok=ok and good
    finally:
        cleaned=True
        for u in reversed(created):
            cleaned=admin_action("delete",[u],None) and cleaned
        print("P168_DISPOSABLE_AUTH_CLEANUP="+("PASS" if cleaned else "FAIL"))
        print("P168_REAL_CUSTOMER_DATA_READ=FALSE P168_OWNER_IMPORTS=0 P168_DEPLOYS=0")
        print("P168_DEPLOYED_FUNCTIONS_ATTESTED=FALSE")
        print("P168_DECISION="+("ISOLATED_CALLABLE_HTTP_GATES_ATTESTED_PRODUCTION_NO_GO"
              if ok and cleaned and len(created)==len(users)
              else "NO_GO_CALLABLE_HTTP_INCOMPLETE"))
    return ok and cleaned and len(created)==len(users)

def main():
    print("P168_MODE=ISOLATED_DEMO_FIREBASE_CALLABLE_HTTP")
    try: source=SOURCE.read_bytes()
    except OSError: print("P168_BLOCK=SOURCE_MISSING");return 1
    try: parts=reviewed(source)
    except (ValueError,UnicodeError):
        print("P168_BLOCK=UNREVIEWED_SOURCE_DRIFT");return 1
    print("P168_PINNED_SOURCE_AND_TWO_HANDLER_ONLY=PASS")
    if not all(shutil.which(x) for x in ("firebase","node")):
        print("P168_BLOCK=LOCAL_CLI_MISSING");return 1
    if not npm_preflight() or not (ROOT/"functions/node_modules").is_dir():
        print("P168_BLOCK=PREINSTALLED_FUNCTIONS_DEPS_MISSING")
        print("P168_REQUIRE_MANUAL_DEPENDENCY_REVIEW=TRUE")
        return 1
    print("P168_PREINSTALLED_FUNCTIONS_SDK=PASS")
    if not HOME.is_dir() or HOME.is_symlink():
        print("P168_BLOCK=PRIVATE_HOME_MISSING");return 1
    for port in PORTS.values():
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as s:
            if s.connect_ex((HOST,port))==0:
                print("P168_BLOCK=ISOLATED_PORT_IN_USE_"+str(port))
                return 1
    old=os.umask(0o077)
    try: tmp=Path(tempfile.mkdtemp(prefix="p168-http-",dir=str(HOME)))
    finally: os.umask(old)
    trace=tmp/"db-trace.txt"
    (tmp/"functions").mkdir(mode=0o700)
    # Reuse already-reviewed installed SDK packages; NEVER invoke npm install.
    (tmp/"functions"/"node_modules").symlink_to(ROOT/"functions/node_modules",target_is_directory=True)
    (tmp/"functions"/"index.js").write_text(generated_index(parts,trace))
    (tmp/"functions"/"package.json").write_text(json.dumps({
      "name":"packtook-p168-demo-only","private":True,"version":"0.0.0",
      "main":"index.js","engines":{"node":"22"},
      "dependencies":{"firebase-functions":"^6.0.0","firebase-admin":"^13.0.0"}}))
    config={"functions":{"source":"functions"},
      "emulators":{"functions":{"host":HOST,"port":PORTS["functions"]},
        "auth":{"host":HOST,"port":PORTS["auth"]},
        "hub":{"host":HOST,"port":PORTS["hub"]},
        "logging":{"host":HOST,"port":PORTS["logging"]},
        "ui":{"enabled":False}}}
    (tmp/"firebase.json").write_text(json.dumps(config))
    log=HOME/"p168-callable-emulator.log"
    old=os.umask(0o077)
    try: fd=log.open("w")
    finally: os.umask(old)
    env={"HOME":str(HOME),"PATH":os.environ.get("PATH",""),
      "CI":"true","NODE_ENV":"test","FIREBASE_SKIP_UPDATE_CHECK":"1",
      "GCLOUD_PROJECT":PROJECT,"GOOGLE_CLOUD_PROJECT":PROJECT,
      "FIREBASE_PROJECT_ID":PROJECT,
      "FIREBASE_AUTH_EMULATOR_HOST":f"{HOST}:{PORTS['auth']}"}
    child=None
    result=1
    try:
        child=subprocess.Popen([shutil.which("firebase"),"emulators:start",
          "--project",PROJECT,"--only","functions,auth",
          "--config",str(tmp/"firebase.json"),"--non-interactive"],
          cwd=str(tmp),env=env,stdout=fd,stderr=subprocess.STDOUT,
          start_new_session=True)
        fd.close()
        ready=False
        for _ in range(75):
            if child.poll() is not None:break
            if reg_ready():
                # An unauthenticated callable request must be handled by loaded
                # Functions code, not merely a registered emulator port.
                code,data=status(FUNCS[0])
                if code==401 and data.get("error",{}).get("status")=="UNAUTHENTICATED":
                    ready=True
                    break
            time.sleep(2)
        print("P168_ISOLATED_CALLABLE_HTTP_READY="+("PASS" if ready else "FAIL"))
        if ready:result=0 if verify(trace) else 1
        else:print("P168_BLOCK=FUNCTIONS_HTTP_NOT_READY")
    except OSError:
        print("P168_BLOCK=CLI_START_FAILED")
        fd.close()
    finally:
        if child and child.poll() is None:
            try:
                os.killpg(child.pid,signal.SIGTERM)
                child.wait(timeout=15)
            except (ProcessLookupError,subprocess.TimeoutExpired):
                try:os.killpg(child.pid,signal.SIGKILL)
                except ProcessLookupError:pass
                child.wait(timeout=5)
        print("P168_EMULATOR_PROCESS_STOPPED=TRUE")
        print("P168_PRIVATE_LOCAL_LOG_ONLY=TRUE")
        # No sensitive synthetic passwords or session tokens persist after run.
        shutil.rmtree(tmp,ignore_errors=True)
        print("P168_LOCAL_GENERATED_RUNTIME_CLEANUP=TRUE")
    return result

if __name__=="__main__":
    try:sys.exit(main())
    except Exception:
        print("P168_BLOCK=LOCAL_EXCEPTION")
        print("P168_DECISION=NO_GO_CALLABLE_HTTP_INCOMPLETE")
        sys.exit(1)
