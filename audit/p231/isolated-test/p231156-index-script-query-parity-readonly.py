#!/usr/bin/env python3
"""P231.156 — exact HTML parity after masking ONLY script-src query versions.
Read-only GET of staging public index. Never print HTML, URLs, query values,
asset versions, keys, identities or fingerprints.
"""
import pathlib,re,sys,urllib.request
from html.parser import HTMLParser
BASE="https://packtook-staging.web.app/index.html"
LOCAL=pathlib.Path("firebase-staging/index.html")
def report(k,v):print("P231_"+k+"="+str(v),flush=True)
report("CHECK","STAGING_INDEX_VERSION_QUERY_ONLY_PARITY_READONLY")
try:
    a=LOCAL.read_text(encoding="utf8")
    request=urllib.request.Request(BASE,method="GET",headers={
       "Accept":"text/html","Cache-Control":"no-cache",
       "User-Agent":"PACKTOOK-P231156-StaticAudit"})
    with urllib.request.urlopen(request,timeout=18) as response:
        if response.status!=200:raise ValueError("http")
        b=response.read(2000001)
        if len(b)>2000000:raise ValueError("too large")
        b=b.decode("utf8")
except Exception:
    report("GATE","BLOCKED_STATIC_READ")
    report("CLOUD_WRITES","0")
    report("DEPLOY","NOT_PERFORMED")
    report("RELEASE","NO_GO")
    sys.exit(2)
# Strict single-or-double-quoted script src syntax only.
PAT=re.compile(r'(<script\b[^>]*\bsrc\s*=\s*)(["\x27])([^"\x27]+)(\2)',re.I)
def normalize(src):
    def sub(match):
        prefix,quote,url,_=match.groups()
        # Only query strings after a local JS asset may be normalized.
        if not re.fullmatch(r'[A-Za-z0-9._/-]+\.js\?v=[A-Za-z0-9._-]+',url):
            return match.group(0)
        return prefix+quote+url.split("?",1)[0]+"?v=REDACTED"+quote
    return PAT.sub(sub,src)
normalized_a=normalize(a);normalized_b=normalize(b)
report("INDEX_EXACT_PARITY","YES" if a==b else "NO")
report("INDEX_PARITY_AFTER_SCRIPT_VERSION_NORMALIZATION",
       "YES" if normalized_a==normalized_b else "NO")
def versioned(s):
    return [m.group(3).split("?",1)[0] for m in PAT.finditer(s)
       if re.fullmatch(r'[A-Za-z0-9._/-]+\.js\?v=[A-Za-z0-9._-]+',m.group(3))]
local_versions=versioned(a);hosted_versions=versioned(b)
report("VERSIONED_SCRIPT_COUNT_LOCAL",len(local_versions))
report("VERSIONED_SCRIPT_COUNT_HOSTED",len(hosted_versions))
report("VERSIONED_SCRIPT_ASSET_BASES_MATCH","YES" if local_versions==hosted_versions else "NO")
# Do not imply real JS file content matches just because index versions align.
candidate_safe=(normalized_a==normalized_b and
                local_versions==hosted_versions and len(local_versions)>0)
report("INDEX_DRIFT_CLASSIFICATION",
       "ONLY_SUPPORTED_SCRIPT_VERSION_QUERIES" if candidate_safe
       else "ADDITIONAL_DIFFERENCES_OR_UNSUPPORTED_SYNTAX")
report("BRIDGE_AND_CONFIG_DRIFT","STILL_UNRESOLVED")
report("HOSTING_DEPLOY_GATE","BLOCKED")
report("RAW_ASSETS_AND_VERSIONS","NOT_PRINTED")
report("CLOUD_REQUESTS","PUBLIC_STATIC_GET_ONLY")
report("CLOUD_WRITES","0")
report("RUNTIME_CALLS","0")
report("DEPLOY","NOT_PERFORMED")
report("RELEASE","NO_GO")
sys.exit(0 if candidate_safe else 3)
