#!/usr/bin/env python3
"""P231.132 isolated staging callable E2E. Tokens in memory only.
Paste one JSON bundle from P231132 Browser into hidden prompt, NOT chat.
All outbound requests only to verified new Cloud Run service. NO cloud writes.
"""
import getpass,json,subprocess,sys,datetime
from zoneinfo import ZoneInfo
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
PROJECT="packtook-staging"
REGION="asia-southeast1"
SERVICE="p231appcheckisolatedprobe"
FN="p231AppCheckIsolatedProbe"
SA="p231-appcheck-probe@packtook-staging.iam.gserviceaccount.com"
def out(k,v):print("P231_"+k+"="+str(v),flush=True)
out("CHECK","ISOLATED_PRIVATE_CALLABLE_E2E_CONTROLLED")
def cmd(*args):
    return subprocess.check_output(args,stderr=subprocess.DEVNULL,
                                   text=True,timeout=25).strip()
try:
    if datetime.datetime.now(ZoneInfo("Asia/Bangkok")).date().isoformat()!="2026-11-26":
        out("GATE","BLOCKED_APPROVAL_DATE_EXPIRED");sys.exit(2)
    if cmd("gcloud","config","get-value","project")!=PROJECT:
        out("GATE","BLOCKED_PROJECT");sys.exit(2)
    active=[x for x in cmd("gcloud","auth","list","--filter=status:ACTIVE",
                              "--format=value(account)").splitlines() if x]
    if len(active)!=1:raise ValueError("identity ambiguous")
    f=json.loads(cmd("gcloud","functions","describe",FN,"--gen2",
                     "--region="+REGION,"--project="+PROJECT,"--format=json"))
    if f.get("state")!="ACTIVE" or f.get("serviceConfig",{}).get("serviceAccountEmail")!=SA:
        raise ValueError("function validation")
    service=json.loads(cmd("gcloud","run","services","describe",SERVICE,
                        "--region="+REGION,"--project="+PROJECT,"--format=json"))
    url=service.get("status",{}).get("url") or service.get("uri")
    import re
    if not isinstance(url,str) or not re.fullmatch(r"https://[a-zA-Z0-9.-]+\.run\.app",url):
        raise ValueError("service URL untrusted")
    if service.get("invokerIamDisabled") is True or service.get("metadata",{}).get("annotations",{}).get("run.googleapis.com/invoker-iam-disabled")=="true":
        raise ValueError("IAM disabled")
    revision=service.get("status",{}).get("latestReadyRevisionName")
    if not revision:raise ValueError("no ready revision")
    policy=json.loads(cmd("gcloud","run","services","get-iam-policy",SERVICE,
                          "--region="+REGION,"--project="+PROJECT,"--format=json"))
    bs=policy.get("bindings",[])
    pub=sum(1 for b in bs if b.get("role")=="roles/run.invoker" for x in b.get("members",[])
            if x in ("allUsers","allAuthenticatedUsers"))
    op=sum(1 for b in bs if b.get("role")=="roles/run.invoker" for x in b.get("members",[])
           if x=="user:"+active[0])
    if pub or op<1:raise ValueError("IAM invoker changes")
    out("SERVICE_PREFLIGHT","PASS")
    out("REVISION_PIN","READY_REVISION_PRESENT")
except Exception:
    out("GATE","BLOCKED_INFRA_OR_IDENTITY")
    sys.exit(2)
try:
    # Google Cloud identity credential must have service URL as audience.
    google=cmd("gcloud","auth","print-identity-token","--audiences="+url)
    if not google or google.count(".")!=2:raise ValueError("IAM token unavailable")
    out("GOOGLE_IAM_ID_TOKEN","ACQUIRED_NOT_PRINTED")
except Exception:
    out("GATE","BLOCKED_AUDIENCE_ID_TOKEN_UNAVAILABLE")
    sys.exit(2)
# Distinguish input failure classes without echoing credentials or exception details.
# NEVER run this with shell tracing or paste credentials into a command argument.
try:
    if not sys.stdin.isatty():
        out("SECRET_INPUT_CLASS","NO_INTERACTIVE_TTY")
        sys.exit(2)
    try:
        raw=getpass.getpass("Paste sensitive P231.132 JSON bundle (hidden input): ")
    except (EOFError,KeyboardInterrupt,OSError):
        out("SECRET_INPUT_CLASS","HIDDEN_PROMPT_UNAVAILABLE_OR_CANCELLED")
        sys.exit(2)
    if not raw:
        out("SECRET_INPUT_CLASS","EMPTY_INPUT")
        sys.exit(2)
    try:
        bundle=json.loads(raw)
    except (ValueError,TypeError):
        out("SECRET_INPUT_CLASS","INVALID_JSON")
        sys.exit(2)
    if not isinstance(bundle,dict):
        out("SECRET_INPUT_CLASS","NOT_JSON_OBJECT")
        sys.exit(2)
    auth=bundle.get("firebaseAuthToken")
    appcheck=bundle.get("appCheckToken")
    if not isinstance(auth,str) or not auth:
        out("SECRET_INPUT_CLASS","FIREBASE_AUTH_TOKEN_FIELD_MISSING")
        sys.exit(2)
    if not isinstance(appcheck,str) or not appcheck:
        out("SECRET_INPUT_CLASS","APPCHECK_TOKEN_FIELD_MISSING")
        sys.exit(2)
    if auth.count(".")!=2:
        out("SECRET_INPUT_CLASS","FIREBASE_AUTH_TOKEN_FORMAT_UNEXPECTED")
        sys.exit(2)
    if appcheck.count(".")!=2:
        out("SECRET_INPUT_CLASS","APPCHECK_TOKEN_FORMAT_UNEXPECTED")
        sys.exit(2)
    del raw,bundle
    out("SECRET_INPUT_CLASS","VALIDATED_IN_MEMORY")
    out("FIREBASE_AUTH_AND_APPCHECK","PRESENT_NOT_PRINTED")
except SystemExit:
    out("GATE","BLOCKED_SECRET_INPUT")
    sys.exit(2)
except Exception:
    out("SECRET_INPUT_CLASS","UNEXPECTED_INPUT_ERROR")
    out("GATE","BLOCKED_SECRET_INPUT")
    sys.exit(2)
# Callable protocol: IAM id token, Firebase Auth and App Check in separate headers.
import urllib.parse
def invoke(appcheck_header):
    headers={
      "Content-Type":"application/json",
      "X-Serverless-Authorization":"Bearer "+google,
      "Authorization":"Bearer "+auth
    }
    if appcheck_header is not None:headers["X-Firebase-AppCheck"]=appcheck_header
    request=Request(url,data=b'{"data":{}}',headers=headers,method="POST")
    try:
        with urlopen(request,timeout=18) as response:
            code=response.status
            body=response.read(8193)
    except HTTPError as exc:
        code=exc.code
        body=exc.read(8193)
    except (URLError,TimeoutError):
        return "NETWORK_FAILURE",None
    if len(body)>8192:return code,None
    try:return code,json.loads(body)
    except (ValueError,UnicodeError):return code,None

def current_revision():
    meta=json.loads(cmd("gcloud","run","services","describe",SERVICE,
                 "--region="+REGION,"--project="+PROJECT,"--format=json"))
    return meta.get("status",{}).get("latestReadyRevisionName")

try:
    code,body=invoke(appcheck)
    valid=(code==200 and isinstance(body,dict)
           and body.get("result",{}).get("probe")=="p231-isolated"
           and body.get("result",{}).get("result")=="PASS")
    out("VALID_HTTP_STATUS",code)
    out("VALID_RESULT","PASS" if valid else "BLOCKED")
    if not valid:
        out("INVALID_NEGATIVE_CASES","SKIPPED_VALID_CONTROL_FAILED")
        out("E2E","NOT_VERIFIED")
        sys.exit(3)
    if current_revision()!=revision:
        out("GATE","BLOCKED_REVISION_DRIFT")
        sys.exit(3)
    out("VALID_CONTROL_GATE","PASS")
    code,body=invoke(None)
    missing_rejected=isinstance(code,int) and code in (400,401,403)
    out("MISSING_APPCHECK_HTTP_STATUS",code)
    out("MISSING_APPCHECK_REJECTED","YES" if missing_rejected else "NO")
    if not missing_rejected:
        out("GATE","BLOCKED_MISSING_TOKEN_ACCEPTED_OR_UNEXPECTED")
        sys.exit(3)
    if current_revision()!=revision:
        out("GATE","BLOCKED_REVISION_DRIFT")
        sys.exit(3)
    code,body=invoke("p231-invalid-appcheck-token")
    invalid_rejected=isinstance(code,int) and code in (400,401,403)
    out("INVALID_APPCHECK_HTTP_STATUS",code)
    out("INVALID_APPCHECK_REJECTED","YES" if invalid_rejected else "NO")
    if current_revision()!=revision:
        out("GATE","BLOCKED_REVISION_DRIFT")
        sys.exit(3)
    out("E2E","HTTP_BEHAVIOR_PASS_NEEDS_LOG_CORROBORATION"
        if invalid_rejected else "BLOCKED_UNEXPECTED_INVALID_RESPONSE")
    sys.exit(0 if invalid_rejected else 3)
except Exception:
    out("GATE","BLOCKED_UNEXPECTED_RUNTIME_ERROR")
    sys.exit(3)
finally:
    out("TOKEN_VALUES","NEVER_PRINTED")
    out("IAM_WRITES","0")
    out("DEPLOY","NOT_PERFORMED")
    out("CLEANUP","NOT_PERFORMED")
    out("RELEASE","NO_GO")
