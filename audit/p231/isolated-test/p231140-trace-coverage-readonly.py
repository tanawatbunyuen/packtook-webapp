#!/usr/bin/env python3
"""P231.140 — Trace coverage diagnosis for isolated staging Cloud Run App Check logs.
Read-only: counts only, no original log text, trace IDs, timestamps, credentials.
"""
import json,subprocess,sys
from collections import Counter
PROJECT="packtook-staging"
SERVICE="p231appcheckisolatedprobe"
def report(key,value): print(f"P231_{key}={value}",flush=True)
report("CHECK","ISOLATED_APPCHECK_TRACE_COVERAGE_READONLY")
try:
    active=subprocess.check_output(["gcloud","config","get-value","project"],
        text=True,stderr=subprocess.DEVNULL,timeout=15).strip()
    if active!=PROJECT:
        report("GATE","BLOCKED_NOT_STAGING");sys.exit(2)
    query=('resource.type="cloud_run_revision" AND '
           'resource.labels.service_name="'+SERVICE+'"')
    raw=subprocess.check_output(["gcloud","logging","read",query,
        "--project="+PROJECT,"--freshness=6h","--limit=1000","--format=json"],
        text=True,stderr=subprocess.DEVNULL,timeout=40)
    entries=json.loads(raw)
    if not isinstance(entries,list): raise ValueError("unexpected response")
except Exception:
    report("GATE","BLOCKED_LOG_FETCH_OR_PARSE")
    report("RELEASE","NO_GO")
    sys.exit(2)

def trace(item):
    t=item.get("trace")
    prefix="projects/"+PROJECT+"/traces/"
    return t if isinstance(t,str) and t.startswith(prefix) and len(t)>len(prefix) else None

def message(item):
    text=item.get("textPayload")
    fields=item.get("jsonPayload")
    snippets=[text[:2048]] if isinstance(text,str) else []
    if isinstance(fields,dict):
        snippets.extend(fields.get(k,"")[:2048] for k in ("message","msg")
          if isinstance(fields.get(k),str))
    return " ".join(snippets).lower()

requests=Counter()
request_401_traces=Counter()
diagnostic_traces=Counter()
count=Counter()
for e in entries:
    if not isinstance(e,dict):continue
    if e.get("resource",{}).get("labels",{}).get("service_name")!=SERVICE:continue
    t=trace(e)
    http=e.get("httpRequest")
    if isinstance(http,dict) and isinstance(http.get("status"),int):
        code=http["status"]
        if code==401:
            count["401_TOTAL"]+=1
            if t: request_401_traces[t]+=1
            else:count["401_WITHOUT_TRACE"]+=1
        elif code==200:count["200_TOTAL"]+=1
    m=message(e)
    if ("app check" in m or "appcheck" in m) and any(
      word in m for word in ("invalid","failed","missing","reject","verify","unauthorized")):
        count["DIAGNOSTIC_TOTAL"]+=1
        if t:diagnostic_traces[t]+=1
        else:count["DIAGNOSTIC_WITHOUT_TRACE"]+=1

matched=sum(n for t,n in request_401_traces.items() if t in diagnostic_traces)
unmatched=sum(n for t,n in request_401_traces.items() if t not in diagnostic_traces)
orphan=sum(n for t,n in diagnostic_traces.items() if t not in request_401_traces)
report("HTTP_200_COUNT",count["200_TOTAL"])
report("HTTP_401_COUNT",count["401_TOTAL"])
report("HTTP_401_WITHOUT_TRACE",count["401_WITHOUT_TRACE"])
report("HTTP_401_WITH_TRACE_NO_APPCHECK_DIAGNOSTIC",unmatched)
report("HTTP_401_WITH_TRACE_MATCHED_DIAGNOSTIC",matched)
report("APPCHECK_DIAGNOSTIC_TOTAL",count["DIAGNOSTIC_TOTAL"])
report("APPCHECK_DIAGNOSTIC_WITHOUT_TRACE",count["DIAGNOSTIC_WITHOUT_TRACE"])
report("APPCHECK_DIAGNOSTIC_TRACE_NOT_MATCHING_401",orphan)
report("CORRELATION","COMPLETE" if count["401_TOTAL"]>=2 and
  matched==count["401_TOTAL"] and count["401_WITHOUT_TRACE"]==0
  else "PARTIAL_OR_UNAVAILABLE")
report("ROOT_CAUSE","INCONCLUSIVE_UNLESS_INDEPENDENT_REQUEST_CORRELATION")
report("RAW_LOGS","NOT_PRINTED")
report("CLOUD_WRITES","0")
report("RUNTIME_CALLS","0")
report("RELEASE","NO_GO")
