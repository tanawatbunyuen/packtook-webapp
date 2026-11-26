#!/usr/bin/env python3
"""P231.169 — isolated candidate source reconciliation simulation.

No cloud writes, no deployment, no Auth/App Check/Functions calls.
Candidate copied into temporary directory, never into repository.
Public staging site-key extracted from current publicly served bridge,
kept only in memory and temporary candidate, then discarded.
Reconciles script version queries to current hosted index only after proving
the sole differences are normalized supported '?v=' query strings.
Retains repository protectedApi fail-closed status guards.
Outputs only safe status booleans and counts; no key/source/URLs/filenames
outside an explicit allowlist.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from html.parser import HTMLParser
from urllib.request import Request,urlopen
import json,os,re,shutil,sys
ROOT=Path("firebase-staging")
BASE="https://packtook-staging.web.app"
NAMES=("index.html","firebase-v4-config.js","firebase-packing-bridge.js")
JS=("firebase-packing-bridge.js","video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js")
def emit(k,v):print("P231_"+k+"="+str(v),flush=True)
def flag(v):return "YES" if v else "NO"
def public(name):
    req=Request(BASE+"/"+name,method="GET",headers={"Accept":"text/html,text/javascript,*/*",
        "Cache-Control":"no-cache","User-Agent":"PACKTOOK-P231169-StaticAudit"})
    with urlopen(req,timeout=18) as res:
        if res.status!=200:raise ValueError("unexpected HTTP status")
        data=res.read(2000001)
        if len(data)>2000000:raise ValueError("too large")
        return data.decode("utf8")
class Scripts(HTMLParser):
    def __init__(self):super().__init__();self.src=[]
    def handle_starttag(self,tag,attrs):
        if tag=="script":
            value=dict(attrs).get("src")
            if value:self.src.append(value)
PAT=re.compile(r'(<script\b[^>]*\bsrc\s*=\s*)(["\x27])([^"\x27]+)\2',re.I)
def normalize(s):
    def sub(m):
        prefix,quote,url=m.groups()
        return prefix+quote+url.split("?")[0]+"?v=REDACTED"+quote if re.fullmatch(r'[A-Za-z0-9._/-]+\.js\?v=[A-Za-z0-9._-]+',url) else m.group(0)
    return PAT.sub(sub,s)
emit("CHECK","STAGING_ISOLATED_RECONCILIATION_CANDIDATE_STATIC")
try:
    h=json.loads(Path("firebase.json").read_text("utf8"))["hosting"]
    if h["public"]!="firebase-staging":raise ValueError("hosting source mismatch")
    if set(h.get("ignore",[]))!={"firebase.json","**/.*","**/node_modules/**"}:
        raise ValueError("ignore mismatch")
    hosted={name:public(name) for name in NAMES}
    local={name:(ROOT/name).read_text("utf8") for name in NAMES}
    if normalize(local["index.html"])!=normalize(hosted["index.html"]):
        raise ValueError("index has non-query drift")
    if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',local["firebase-v4-config.js"]):
        raise ValueError("local config not staging")
    if not re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',hosted["firebase-v4-config.js"]):
        raise ValueError("hosted config not staging")
    m=re.search(r'new\s+ReCaptchaEnterpriseProvider\s*\(\s*(["\x27])([^"\x27\\]+)\1\s*\)',hosted["firebase-packing-bridge.js"])
    if not m or not re.fullmatch(r"[A-Za-z0-9_-]{20,300}",m.group(2)):
        raise ValueError("hosted public site key unexpected")
    site_key=m.group(2)
    local_key_pattern=r'(export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*)(["\x27])\2\s*;'
    if len(re.findall(local_key_pattern,local["firebase-v4-config.js"]))!=1:
        raise ValueError("local config key not blank exactly once")
except Exception:
    emit("GATE","BLOCKED_LOCAL_OR_PUBLIC_ASSET_INPUT")
    emit("CLOUD_WRITES","0");emit("DEPLOY","NOT_PERFORMED");emit("RELEASE","NO_GO")
    sys.exit(2)

try:
    with TemporaryDirectory(prefix="p231169-candidate-") as temporary:
        dest=Path(temporary)/"hosting"
        shutil.copytree(ROOT,dest,symlinks=False)
        current=(dest/"firebase-v4-config.js").read_text("utf8")
        candidate_cfg=re.sub(local_key_pattern,lambda m:m.group(1)+'"'+site_key+'";',current,count=1)
        (dest/"firebase-v4-config.js").write_text(candidate_cfg,encoding="utf8")

        # Preserve hosted index script version queries ONLY, after exact version-normalized parity.
        # This never copies the hosted Bridge or removes the local protectedApi guard.
        candidate_index=hosted["index.html"]
        (dest/"index.html").write_text(candidate_index,encoding="utf8")
        bridge=(dest/"firebase-packing-bridge.js").read_text("utf8")
        refs=Scripts();refs.feed(candidate_index)
        basenames=[]
        for src in refs.src:
            match=re.fullmatch(r'([A-Za-z0-9_-]+\.js)\?v=[A-Za-z0-9._-]+',src)
            if not match:raise ValueError("index version source unsupported")
            basenames.append(match.group(1))
        all_expected=(len(basenames)==5 and set(basenames)==set(JS))
        tests={
            "FIVE_VERSIONED_SCRIPT_REFS":all_expected,
            "STAGING_PROJECT_PRESERVED":bool(re.search(r'\bprojectId\s*:\s*["\x27]packtook-staging["\x27]',candidate_cfg)),
            "ENTERPRISE_SITE_KEY_INJECTED":site_key in candidate_cfg,
            "SAME_APP_FUNCTIONS_REGION":bool(re.search(r'\bgetFunctions\s*\(\s*app\s*,\s*["\x27]asia-southeast1["\x27]',bridge)),
            "APP_CHECK_INITIALIZATION":all(x in bridge for x in (
                "initializeAppCheck(app,","new ReCaptchaEnterpriseProvider(recaptchaEnterpriseSiteKey.trim())",
                "isTokenAutoRefreshEnabled:true")),
            "USAGE_AND_RECORDING_FAIL_CLOSED":all(x in bridge for x in (
                "appCheckReady",'protectedApi("usageStatus")','protectedApi("recordingStatus")')),
            "BRIDGE_REPOSITORY_BYTES_PRESERVED":bridge==local["firebase-packing-bridge.js"],
            "INDEX_MATCHES_HOSTED":candidate_index==hosted["index.html"],
            "OTHER_FOUR_JS_SOURCE_PRESERVED":all((dest/x).read_bytes()==(ROOT/x).read_bytes() for x in JS if x!="firebase-packing-bridge.js"),
            "REFERENCED_JS_ASSETS_PRESENT":all((dest/x).is_file() for x in JS)
        }
        for k,v in tests.items():emit(k,flag(v))
        passing=all(tests.values())
        emit("OFFLINE_RECONCILIATION_TESTS",f"{sum(tests.values())}/{len(tests)}_"+("PASS" if passing else "FAIL"))
        emit("CANDIDATE_BRIDGE_VS_HOSTED","DRIFT_BY_DESIGN")
        emit("CANDIDATE_CONFIG_VS_HOSTED","DRIFT_BY_DESIGN")
        emit("CANDIDATE_INDEX_VS_HOSTED","MATCH" if tests["INDEX_MATCHES_HOSTED"] else "DRIFT")
        emit("CANDIDATE_RUNTIME_SMOKE","NOT_PERFORMED")
        emit("SOURCE_TREE_WRITES","0")
        emit("TEMPORARY_CANDIDATE","GENERATED_FOR_TEST_ONLY")
    emit("TEMPORARY_CANDIDATE_AFTER_SCOPE","DISCARDED")
    emit("DEPLOYABLE_ARTIFACT_PERSISTED","NO")
    emit("FIREBASE_CLI_PACKAGING_PARITY","NOT_VERIFIED")
    emit("PUBLIC_SITE_KEY_VALUE","NOT_PRINTED")
    emit("BUSINESS_FUNCTION_CALLS","0")
    emit("CLOUD_WRITES","0")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(0 if passing else 3)
except Exception:
    emit("GATE","BLOCKED_CANDIDATE_BUILD_OR_VALIDATION")
    emit("BUSINESS_FUNCTION_CALLS","0")
    emit("CLOUD_WRITES","0")
    emit("DEPLOY","NOT_PERFORMED")
    emit("RELEASE","NO_GO")
    sys.exit(2)
