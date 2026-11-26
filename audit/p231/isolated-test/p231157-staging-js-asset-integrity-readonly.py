#!/usr/bin/env python3
"""P231.157: audit versioned staging client assets against hosted static assets.
Read-only GET, no keys, source output, credentials, backend requests or writes.
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request,urlopen
import re,sys
BASE="https://packtook-staging.web.app"
ROOT=Path("firebase-staging")
ASSETS=("firebase-packing-bridge.js","video-history-db.js","video-stream-writer.js","performance-monitor.js","app.js")
def out(k,v):print("P231_"+k+"="+str(v),flush=True)
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.scripts={}
 def handle_starttag(self,tag,attrs):
  if tag!="script":return
  d=dict(attrs);src=d.get("src")
  if not src:return
  m=re.fullmatch(r"([A-Za-z0-9_-]+\.js)\?v=([A-Za-z0-9._-]+)",src)
  if m:self.scripts[m.group(1)]=m.group(2)
  else:raise ValueError("unknown or unversioned script reference")
def hosted(name):
 req=Request(BASE+"/"+name,headers={"Accept":"text/javascript,text/html,*/*",
   "Cache-Control":"no-cache","User-Agent":"PACKTOOK-P231157-ReadOnly"},method="GET")
 with urlopen(req,timeout=18) as response:
  if response.status!=200:raise ValueError("non-200")
  data=response.read(2000001)
  if len(data)>2000000:raise ValueError("oversize")
  return data.decode("utf8")
out("CHECK","STAGING_HOSTING_FIVE_JS_ASSET_INTEGRITY_READONLY")
try:
 local_index=(ROOT/"index.html").read_text("utf8");remote_index=hosted("index.html")
 a=Parser();a.feed(local_index);b=Parser();b.feed(remote_index)
 if set(a.scripts)!=set(ASSETS) or set(b.scripts)!=set(ASSETS):
  raise ValueError("script inventory must exactly match allowlist")
except Exception:
 out("GATE","BLOCKED_INDEX_OR_SCRIPT_INVENTORY")
 out("CLOUD_WRITES","0");out("DEPLOY","NOT_PERFORMED");out("RELEASE","NO_GO");sys.exit(2)
drift=0;fail=0
for name in ASSETS:
 label=name[:-3].upper().replace("-","_")
 try:
  local=(ROOT/name).read_text("utf8")
  remote=hosted(name)
  match=local==remote
  if not match:drift+=1
  out("ASSET_"+label+"_CONTENT_PARITY","MATCH" if match else "DRIFT")
  out("ASSET_"+label+"_VERSION_QUERY_PARITY",
      "MATCH" if a.scripts[name]==b.scripts[name] else "DRIFT")
 except Exception:
  fail+=1;out("ASSET_"+label+"_CONTENT_PARITY","UNAVAILABLE")
out("ASSETS_CHECKED",len(ASSETS))
out("ASSET_CONTENT_DRIFT_COUNT",drift)
out("ASSET_UNAVAILABLE_COUNT",fail)
out("INDEX_VERSIONED_ASSETS_MATCH_EXPECTED","YES")
out("CANONICAL_ASSET_RECONCILIATION","REVIEW_REQUIRED" if drift or fail else "STATIC_JS_MATCH")
out("HOSTING_DEPLOY_GATE","BLOCKED_PENDING_FULL_ARTIFACT_REVIEW")
out("RAW_ASSET_CONTENT","NOT_PRINTED")
out("PUBLIC_SITE_KEY_VALUE","NOT_PRINTED")
out("HTTP_REQUESTS","PUBLIC_STATIC_GET_ONLY")
out("CLOUD_WRITES","0")
out("BUSINESS_CALLS","0")
out("DEPLOY","NOT_PERFORMED")
out("RELEASE","NO_GO")
sys.exit(2 if fail else 0)
