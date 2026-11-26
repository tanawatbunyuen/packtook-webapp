#!/usr/bin/env python3
"""P231.155 — Index one-line drift safe taxonomy without exposing text/keys.
Only read local index and hosted static index, classify changed line by parsers.
No source modifications, auth, tokens, or function invocation.
"""
import difflib, pathlib, re, sys, urllib.request
from html.parser import HTMLParser
from collections import Counter

BASE="https://packtook-staging.web.app"
def report(k,v):print(f"P231_{k}={v}",flush=True)
report("CHECK","STAGING_INDEX_SINGLE_LINE_DRIFT_TAXONOMY_READONLY")
try:
    a=pathlib.Path("firebase-staging/index.html").read_text(encoding="utf8")
    req=urllib.request.Request(BASE+"/index.html",method="GET",headers={
      "Cache-Control":"no-cache","User-Agent":"PACKTOOK-P231155-ReadOnly"})
    with urllib.request.urlopen(req,timeout=18) as rsp:
        if rsp.status!=200:raise ValueError("http status")
        buf=rsp.read(2000001)
        if len(buf)>2000000:raise ValueError("asset size")
        b=buf.decode("utf8")
except Exception:
    report("GATE","BLOCKED_SOURCE_READ")
    report("RELEASE","NO_GO");sys.exit(2)

class Parse(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags=Counter();self.ids=set();self.attrs=Counter();self.texts=[]
        self.script_refs=[];self.style_refs=[];self.inline_scripts=0
    def handle_starttag(self,tag,attrs):
        self.tags[tag]+=1
        d=dict(attrs)
        if "id" in d:self.ids.add(d["id"])
        for k,v in attrs:
            self.attrs[(tag,k)]+=1
        if tag=="script":
            if "src" in d:self.script_refs.append(d["src"])
            else:self.inline_scripts+=1
        if tag=="link" and d.get("rel")=="stylesheet":self.style_refs.append(d.get("href",""))
    def handle_data(self,data):
        x=data.strip()
        if x:self.texts.append(x)
p,q=Parse(),Parse();p.feed(a);q.feed(b)
ops=[(tag,i,j,k,l) for tag,i,j,k,l in
    difflib.SequenceMatcher(None,a.splitlines(),b.splitlines(),autojunk=False).get_opcodes()
    if tag!="equal"]
report("INDEX_CHANGED_BLOCK_COUNT",len(ops))
report("INDEX_LOCAL_CHANGED_LINE_COUNT",sum(j-i for _,i,j,_,_ in ops))
report("INDEX_HOSTED_CHANGED_LINE_COUNT",sum(l-k for _,_,_,k,l in ops))
report("INDEX_TAG_MULTISETS_EQUAL","YES" if p.tags==q.tags else "NO")
report("INDEX_ID_SETS_EQUAL","YES" if p.ids==q.ids else "NO")
report("INDEX_ATTRIBUTE_NAME_COUNTS_EQUAL","YES" if p.attrs==q.attrs else "NO")
report("INDEX_SCRIPT_REFERENCE_BASES_EQUAL","YES" if [v.split("?")[0] for v in p.script_refs]==[v.split("?")[0] for v in q.script_refs] else "NO")
report("INDEX_SCRIPT_VERSION_QUERIES_EQUAL","YES" if p.script_refs==q.script_refs else "NO")
report("INDEX_STYLESHEET_REFERENCE_BASES_EQUAL","YES" if [v.split("?")[0] for v in p.style_refs]==[v.split("?")[0] for v in q.style_refs] else "NO")
report("INDEX_STYLESHEET_VERSION_QUERIES_EQUAL","YES" if p.style_refs==q.style_refs else "NO")
report("INDEX_TEXT_NODES_EQUAL","YES" if p.texts==q.texts else "NO")
report("INDEX_TEXT_NODE_COUNTS_EQUAL","YES" if len(p.texts)==len(q.texts) else "NO")
report("INDEX_INLINE_SCRIPT_COUNTS_EQUAL","YES" if p.inline_scripts==q.inline_scripts else "NO")
# A change in attribute values, embedded scripts, or text can carry behavioral risk.
# These whitelisted results support a review, never a deploy-safe conclusion.
report("INDEX_DIFFERENCE_CLASSIFICATION","STRUCTURAL_FLAGS_ONLY")
report("INDEX_BEHAVIORAL_EQUIVALENCE","NOT_VERIFIED")
report("HOSTING_DEPLOY_GATE","BLOCKED")
report("RAW_INDEX_OR_VALUES","NOT_PRINTED")
report("NETWORK_REQUESTS","STATIC_GET_ONLY")
report("CLOUD_WRITES","0")
report("RUNTIME_CALLS","0")
report("DEPLOY","NOT_PERFORMED")
report("RELEASE","NO_GO")
