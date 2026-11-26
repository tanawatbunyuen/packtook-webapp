#!/usr/bin/env python3
"""P231.145: read-only hosted-staging normal-client call-path classification.
Static HTTP GET only. No token requests, login, callable invocation or writes.
Print boolean patterns/counts only; never print JS/HTML/config/key identifiers.
"""
import pathlib,re,sys,urllib.request
BASE="https://packtook-staging.web.app"
def out(k,v):print(f"P231_{k}={v}",flush=True)
out("CHECK","HOSTED_NORMAL_CLIENT_CALL_PATH_STATIC_READONLY")
try:
    src=pathlib.Path("firebase-staging/firebase-packing-bridge.js").read_text(encoding="utf-8")
    req=urllib.request.Request(BASE+"/firebase-packing-bridge.js",method="GET",
       headers={"Accept":"text/javascript","Cache-Control":"no-cache","User-Agent":"Packtook-P231145-Static-Audit"})
    with urllib.request.urlopen(req,timeout=15) as response:
        if response.status!=200:raise ValueError("status")
        b=response.read(2000001)
        if len(b)>2000000:raise ValueError("size")
        hosted=b.decode("utf-8")
except Exception:
    out("GATE","BLOCKED_SOURCE_OR_HOSTED_BRIDGE_READ")
    out("RELEASE","NO_GO")
    sys.exit(2)

def yes(x):return "YES" if x else "NO"
def has(text,pattern):return bool(re.search(pattern,text))
def flags(prefix,content):
    # These are narrowly matching static patterns, not execution proof.
    out(prefix+"_APPCHECK_INITIALIZE",yes(has(content,r'\binitializeAppCheck\s*\(')))
    out(prefix+"_APPCHECK_PROVIDER",yes(has(content,r'\bnew\s+ReCaptchaEnterpriseProvider\s*\(')))
    out(prefix+"_FUNCTIONS_SAME_APP_INITIALIZED",yes(has(content,r'\bgetFunctions\s*\(\s*app\s*,')))
    out(prefix+"_HTTPS_CALLABLE_HELPER",yes(has(content,r'\bhttpsCallable\s*\(')))
    out(prefix+"_PROTECTED_API_DECLARED",yes(has(content,r'\bprotectedApi\s*=')))
    out(prefix+"_USAGE_STATUS_NAME_PRESENT",yes("usageStatus" in content))
    out(prefix+"_RECORDING_STATUS_NAME_PRESENT",yes("recordingStatus" in content))
    out(prefix+"_USAGE_STATUS_PROTECTED_CALL",yes(has(content,r'protectedApi\s*\(\s*["\']usageStatus["\']')))
    out(prefix+"_RECORDING_STATUS_PROTECTED_CALL",yes(has(content,r'protectedApi\s*\(\s*["\']recordingStatus["\']')))
    out(prefix+"_USAGE_STATUS_DIRECT_CALLABLE",yes(has(content,r'httpsCallable\s*\([^)]*["\']usageStatus["\']')))
    out(prefix+"_RECORDING_STATUS_DIRECT_CALLABLE",yes(has(content,r'httpsCallable\s*\([^)]*["\']recordingStatus["\']')))
    out(prefix+"_USAGE_STATUS_API_WRAPPER",yes(has(content,r'\bapi\s*\(\s*["\']usageStatus["\']')))
    out(prefix+"_RECORDING_STATUS_API_WRAPPER",yes(has(content,r'\bapi\s*\(\s*["\']recordingStatus["\']')))
    out(prefix+"_USAGE_STATUS_BRIDGE_METHOD",yes(has(content,r'\b(?:async\s+)?usage\s*\(')))
    out(prefix+"_RECORDING_STATUS_BRIDGE_METHOD",yes(has(content,r'\b(?:async\s+)?recordingStatus\s*\(')))
    out(prefix+"_FAIL_CLOSED_KEY_READY_FLAG",yes("appCheckReady" in content))
    out(prefix+"_APP_CHECK_TOKEN_EXPLICIT_HEADER",yes("X-Firebase-AppCheck" in content))
    out(prefix+"_ASYNC_INITIALIZE_ORDER_STATIC", "NOT_PROVABLE_BY_REGEX")
flags("LOCAL",src)
flags("HOSTED",hosted)
out("HOSTED_CALL_PATH","STATIC_PATTERNS_ONLY_NOT_EXECUTION")
out("NORMAL_CLIENT_TOKEN_ATTACHMENT","NOT_VERIFIED")
out("HTTP_CALLS","STATIC_BRIDGE_GET_ONLY")
out("CREDENTIALS","NOT_ACQUIRED")
out("CLOUD_WRITES","0")
out("DEPLOY","NOT_PERFORMED")
out("RELEASE","NO_GO")
