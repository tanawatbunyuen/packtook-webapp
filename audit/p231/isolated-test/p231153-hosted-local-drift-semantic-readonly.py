#!/usr/bin/env python3
"""P231.153 — Hosted/local staging semantic drift inventory (read-only).
Checks structural feature counts and local-vs-hosted differences only.
Never prints code, key material, URL query strings, Firebase IDs or hashes.
"""
import difflib,pathlib,re,sys,urllib.request
from html.parser import HTMLParser
BASE="https://packtook-staging.web.app"
NAMES=("firebase-packing-bridge.js","firebase-v4-config.js","index.html")
ROOT=pathlib.Path("firebase-staging")
def emit(k,v):print(f"P231_{k}={v}",flush=True)
def present(s,pattern):return bool(re.search(pattern,s))
class Page(HTMLParser):
    def __init__(self):
        super().__init__();self.scripts=[];self.ids=set();self.forms=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=="script" and a.get("src"):
            self.scripts.append(a["src"].split("?")[0])
        if tag=="form":self.forms+=1
        if a.get("id"):self.ids.add(a["id"])
def features_bridge(s):
    patterns={
      "APPCHECK_INITIALIZE":r"\binitializeAppCheck\s*\(",
      "APPCHECK_ENTERPRISE_PROVIDER":r"\bnew\s+ReCaptchaEnterpriseProvider\s*\(",
      "APPCHECK_AUTO_REFRESH":r"\bisTokenAutoRefreshEnabled\s*:\s*true",
      "FUNCTIONS_SAME_APP":r"\bgetFunctions\s*\(\s*app\s*,",
      "PROTECTED_API_DECLARED":r"\bprotectedApi\s*=",
      "APP_CHECK_READY_GUARD":r"\bappCheckReady\b",
      "USAGE_CALL_PROTECTED":r'protectedApi\s*\(\s*["\x27]usageStatus["\x27]',
      "USAGE_CALL_API":r'\bapi\s*\(\s*["\x27]usageStatus["\x27]',
      "RECORDING_CALL_PROTECTED":r'protectedApi\s*\(\s*["\x27]recordingStatus["\x27]',
      "RECORDING_CALL_API":r'\bapi\s*\(\s*["\x27]recordingStatus["\x27]',
      "BRIDGE_EXPORT":r"window\.PACKTOOK_FIREBASE\s*=",
      "FIREBASE_SDK_CALLABLE":r"\bhttpsCallable\s*\(",
      "SITE_KEY_CONFIG_IMPORT":r"import\s*\{[^}]*\brecaptchaEnterpriseSiteKey\b",
      "SITE_KEY_LITERAL_IN_PROVIDER":r'new\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])[^"\x27]+\1\s*\)',
    }
    return {k:present(s,p) for k,p in patterns.items()}
def features_config(s):
    return {
      "CONFIG_STAGING_PROJECT":present(s,r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]'),
      "CONFIG_SITE_KEY_EXPORT":present(s,r"export\s+const\s+recaptchaEnterpriseSiteKey\s*="),
      "CONFIG_SITE_KEY_EMPTY":present(s,r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1'),
      "CONFIG_SITE_KEY_NONEMPTY":present(s,r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])[^"\x27]+\1'),
    }
emit("CHECK","STAGING_HOSTED_LOCAL_SOURCE_DRIFT_SEMANTIC_READONLY")
local={};remote={}
try:
    for n in NAMES:local[n]=(ROOT/n).read_text(encoding="utf8")
    for n in NAMES:
        req=urllib.request.Request(BASE+"/"+n,method="GET",headers={
         "Accept":"text/javascript,text/html,*/*","Cache-Control":"no-cache",
         "User-Agent":"PACKTOOK-P231153-ReadOnly"})
        with urllib.request.urlopen(req,timeout=18) as response:
            if response.status!=200:raise ValueError("HTTP status")
            b=response.read(2000001)
            if len(b)>2000000:raise ValueError("asset length")
            remote[n]=b.decode("utf8")
except Exception:
    emit("GATE","BLOCKED_READ_SOURCE_OR_HOSTED_STATIC")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(2)
for n,label in ((NAMES[0],"BRIDGE"),(NAMES[1],"CONFIG"),(NAMES[2],"INDEX")):
    a=local[n].splitlines();b=remote[n].splitlines()
    opcodes=difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes()
    changes=[op for op in opcodes if op[0]!="equal"]
    emit(label+"_PARITY","MATCH" if not changes else "DRIFT")
    emit(label+"_CHANGED_BLOCK_COUNT",len(changes))
    emit(label+"_LOCAL_LINE_COUNT",len(a))
    emit(label+"_HOSTED_LINE_COUNT",len(b))
for n,label,fn in ((NAMES[0],"BRIDGE",features_bridge),(NAMES[1],"CONFIG",features_config)):
    a=fn(local[n]);b=fn(remote[n])
    for k in a:
        if a[k]!=b[k]:
            emit(label+"_SEMANTIC_DRIFT_"+k,"LOCAL_"+("YES" if a[k] else "NO")+"_HOSTED_"+("YES" if b[k] else "NO"))
    emit(label+"_FEATURE_DIFF_COUNT",sum(a[k]!=b[k] for k in a))
a=Page();a.feed(local[NAMES[2]])
b=Page();b.feed(remote[NAMES[2]])
# Only whitelist expected static asset names; no arbitrary script URL leakage.
known=("firebase-packing-bridge.js","app.js","video-history-db.js",
       "video-stream-writer.js","performance-monitor.js")
for asset in known:
    emit("INDEX_LOCAL_"+asset.split(".")[0].upper().replace("-","_")+"_SCRIPT",
         "YES" if asset in a.scripts else "NO")
    emit("INDEX_HOSTED_"+asset.split(".")[0].upper().replace("-","_")+"_SCRIPT",
         "YES" if asset in b.scripts else "NO")
emit("INDEX_SCRIPTS_UNNAMED_EXTRA_LOCAL",len([v for v in a.scripts if v not in known]))
emit("INDEX_SCRIPTS_UNNAMED_EXTRA_HOSTED",len([v for v in b.scripts if v not in known]))
emit("INDEX_FORM_COUNT_EQUAL","YES" if a.forms==b.forms else "NO")
emit("INDEX_DOM_ID_COMMON_COUNT",len(a.ids & b.ids))
emit("INDEX_DOM_ID_ONLY_LOCAL_COUNT",len(a.ids-b.ids))
emit("INDEX_DOM_ID_ONLY_HOSTED_COUNT",len(b.ids-a.ids))
emit("INDEX_DOM_STRUCTURE_COMPARE","SUMMARY_ONLY_NOT_RENDERED_BEHAVIOR")
emit("CANONICAL_SOURCE_RECONCILIATION","REVIEW_REQUIRED")
emit("RAW_SOURCE_AND_KEYS","NOT_PRINTED")
emit("TOKEN_REQUESTS","0")
emit("BUSINESS_REQUESTS","0")
emit("CLOUD_WRITES","0")
emit("DEPLOY","NOT_PERFORMED")
emit("RELEASE","NO_GO")
