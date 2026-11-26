#!/usr/bin/env python3
"""P231.146 — Read-only static initialization order checks for hosted bridge.
GET only hosted static JS; no backend requests, auth or App Check tokens.
Print only derived structural flags, never source or key values.
"""
import re,sys,urllib.request
URL="https://packtook-staging.web.app/firebase-packing-bridge.js"
def emit(k,v):print(f"P231_{k}={v}",flush=True)
emit("CHECK","HOSTED_NORMAL_CLIENT_APPCHECK_INITIALIZATION_ORDER_STATIC")
try:
    req=urllib.request.Request(URL,headers={"Accept":"text/javascript",
       "Cache-Control":"no-cache","User-Agent":"PACKTOOK-P231146-ReadOnly"},method="GET")
    with urllib.request.urlopen(req,timeout=15) as res:
        if res.status!=200:raise ValueError("unexpected HTTP")
        data=res.read(2000001)
        if len(data)>2000000:raise ValueError("asset too large")
        s=data.decode("utf8")
except Exception:
    emit("GATE","BLOCKED_HOSTED_BRIDGE_FETCH")
    emit("RELEASE","NO_GO")
    sys.exit(2)
def pos(pattern):
    match=re.search(pattern,s,re.MULTILINE)
    return match.start() if match else -1
def show(k,val):emit(k,"YES" if val else "NO")
app=pos(r'\binitializeApp\s*\(')
functions=pos(r'\bgetFunctions\s*\(')
appcheck=pos(r'\binitializeAppCheck\s*\(')
provider=pos(r'\bnew\s+ReCaptchaEnterpriseProvider\s*\(')
callable_helper=pos(r'\bhttpsCallable\s*\(')
bridge_export=pos(r'\bwindow\.PACKTOOK_FIREBASE\s*=')
usage=pos(r'\busage\s*\(')
recording=pos(r'\brecordingStatus\s*\(')
show("APP_INITIALIZER_PRESENT",app>=0)
show("FUNCTIONS_INITIALIZER_PRESENT",functions>=0)
show("APPCHECK_INITIALIZER_PRESENT",appcheck>=0)
show("ENTERPRISE_PROVIDER_PRESENT",provider>=0)
show("CALLABLE_HELPER_PRESENT",callable_helper>=0)
show("BRIDGE_EXPORTED_PRESENT",bridge_export>=0)
show("USAGE_METHOD_PRESENT",usage>=0)
show("RECORDING_METHOD_PRESENT",recording>=0)
show("INIT_APPCHECK_BEFORE_BRIDGE_EXPORT",appcheck>=0 and bridge_export>=0 and appcheck<bridge_export)
show("INIT_APPCHECK_BEFORE_CALLABLE_HELPER",appcheck>=0 and callable_helper>=0 and appcheck<callable_helper)
show("INIT_APPCHECK_BEFORE_STATUS_METHODS",appcheck>=0 and usage>=0 and recording>=0 and appcheck<usage and appcheck<recording)
show("SAME_APP_PATTERN",bool(re.search(r'\bgetFunctions\s*\(\s*app\s*,',s)) and
     bool(re.search(r'\binitializeAppCheck\s*\(\s*app\s*,',s)))
show("AUTO_REFRESH_ENABLED",bool(re.search(r'\bisTokenAutoRefreshEnabled\s*:\s*true\b',s)))
show("PROTECTED_API_GUARD_PRESENT",bool(re.search(r'\bprotectedApi\s*=',s)))
show("STATUS_DIRECT_API_USAGE",bool(re.search(r'\bapi\s*\(\s*["\']usageStatus["\']',s)) and
     bool(re.search(r'\bapi\s*\(\s*["\']recordingStatus["\']',s)))
show("INITIALIZE_WRAPPED_IN_TRY",bool(re.search(r'try\s*\{[^{}]{0,1000}\binitializeAppCheck\s*\(',s,re.DOTALL)))
emit("ANALYSIS_SCOPE","TEXTUAL_ORDER_ONLY_NOT_EXECUTION_PROOF")
emit("AUTOMATIC_TOKEN_ATTACHMENT","NOT_VERIFIED")
emit("BACKEND_CALLS","0")
emit("CREDENTIALS","NONE")
emit("CLOUD_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
