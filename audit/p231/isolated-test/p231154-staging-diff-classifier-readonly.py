#!/usr/bin/env python3
"""P231.154 — Read-only staging hosted/local drift review, safe structural output.
No source/key/auth data is printed. No deploy, backend requests or writes.
"""
import difflib, pathlib, re, sys, urllib.request
from html.parser import HTMLParser
BASE="https://packtook-staging.web.app"
FILES=("firebase-packing-bridge.js","firebase-v4-config.js","index.html")
ROOT=pathlib.Path("firebase-staging")
def report(k,v):print(f"P231_{k}={v}",flush=True)
class Parser(HTMLParser):
    def __init__(self):super().__init__();self.ids=set();self.scripts=[];self.tags={};self.stylesheets=0
    def handle_starttag(self,tag,attrs):
        a=dict(attrs);self.tags[tag]=self.tags.get(tag,0)+1
        if a.get("id"):self.ids.add(a["id"])
        if tag=="script" and a.get("src"):self.scripts.append(a["src"].split("?")[0])
        if tag=="link" and a.get("rel")=="stylesheet":self.stylesheets+=1
report("CHECK","SOURCE_RECONCILIATION_DIFFERENCE_CLASSIFIER_READONLY")
try:
    local={n:(ROOT/n).read_text(encoding="utf8") for n in FILES}
    remote={}
    for n in FILES:
        req=urllib.request.Request(BASE+"/"+n,method="GET",headers={
          "Accept":"text/javascript,text/html,*/*","Cache-Control":"no-cache",
          "User-Agent":"PACKTOOK-P231154-StaticAudit"})
        with urllib.request.urlopen(req,timeout=20) as resp:
            if resp.status!=200:raise ValueError("HTTP status")
            buf=resp.read(2000001)
            if len(buf)>2000000:raise ValueError("size limit")
            remote[n]=buf.decode("utf8")
except Exception:
    report("GATE","BLOCKED_LOCAL_OR_HOSTED_READ");report("RELEASE","NO_GO");sys.exit(2)

def signature(s):
    return re.sub(r"\s+","",s)
def diff_props(local_s,remote_s):
    a=local_s.splitlines();b=remote_s.splitlines()
    ops=[(tag,a[i:j],b[k:l]) for tag,i,j,k,l in
       difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes() if tag!="equal"]
    return (len(ops),sum(len(x) for _,x,_ in ops),sum(len(y) for _,_,y in ops),
      all(signature("".join(x))==signature("".join(y)) for _,x,y in ops))
for name,label in ((FILES[0],"BRIDGE"),(FILES[1],"CONFIG"),(FILES[2],"INDEX")):
    changed,local_lines,hosted_lines,whitespace_only=diff_props(local[name],remote[name])
    report(label+"_CHANGED_BLOCKS",changed)
    report(label+"_CHANGED_LOCAL_LINES",local_lines)
    report(label+"_CHANGED_HOSTED_LINES",hosted_lines)
    report(label+"_CHANGED_BLOCKS_WHITESPACE_ONLY","YES" if whitespace_only else "NO")
p=Parser();p.feed(local["index.html"])
q=Parser();q.feed(remote["index.html"])
report("INDEX_TAG_COUNTS_EQUAL","YES" if p.tags==q.tags else "NO")
report("INDEX_DOM_IDS_EQUAL","YES" if p.ids==q.ids else "NO")
report("INDEX_SCRIPT_REFERENCES_EQUAL","YES" if p.scripts==q.scripts else "NO")
report("INDEX_STYLESHEET_COUNT_EQUAL","YES" if p.stylesheets==q.stylesheets else "NO")
# Client staging app-check source guard must remain non-mutating until canonical review.
bridge=local["firebase-packing-bridge.js"]
config=local["firebase-v4-config.js"]
checks={
 "LOCAL_BRIDGE_APPCHECK_ENFORCED_BY_READY_GUARD":'protectedApi("usageStatus")' in bridge and 'protectedApi("recordingStatus")' in bridge and 'appCheckReady' in bridge,
 "LOCAL_CONFIG_SITE_KEY_EMPTY":bool(re.search(r'export\s+const\s+recaptchaEnterpriseSiteKey\s*=\s*(["\x27])\1\s*;',config)),
 "LOCAL_SDK_CALLABLE_PRESENT":"httpsCallable(" in bridge,
}
for k,v in checks.items():report(k,"YES" if v else "NO")
report("CANONICAL_RECONCILIATION","REVIEW_REQUIRED")
report("HOSTING_DEPLOY_GATE","BLOCKED")
report("HTTP_REQUESTS","PUBLIC_STATIC_ASSETS_ONLY")
report("CREDENTIALS","NOT_ACQUIRED")
report("SOURCE_WRITES","0")
report("CLOUD_WRITES","0")
report("DEPLOY","NOT_PERFORMED")
report("RELEASE","NO_GO")
